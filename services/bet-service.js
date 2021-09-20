const userService = require('./user-service');
const tradeService = require('./trade-service');
const eventService = require('./event-service');
const websocketService = require('./websocket-service');
const { Bet, Trade, Event } = require('@wallfair.io/wallfair-commons').models;
const { BetContract, Erc20 } = require('@wallfair.io/smart_contract_mock');
const { toPrettyBigDecimal, toCleanBigDecimal } = require('../util/number-helper');

const WFAIR = new Erc20('WFAIR');

exports.editBet = async (betId, betData) => {
  const updatedEvent = await Bet.findByIdAndUpdate(betId, betData, { new: true });
  return updatedEvent;
};

exports.placeBet = async (userId, betId, amount, outcome, minOutcomeTokens) => {
  const LOG_TAG = '[CREATE-BET]';

  amount = parseFloat(amount).toFixed(4);
  const bigAmount = toCleanBigDecimal(amount);
  amount = BigInt(bigAmount.getValue());

  let minOutcomeTokensToBuy = 1n;
  if (minOutcomeTokens > 1) {
    minOutcomeTokensToBuy = BigInt(minOutcomeTokens);
  }

  const bet = await eventService.getBet(betId);
  console.debug(LOG_TAG, 'Placing Bet', betId, userId);

  if (!eventService.isBetTradable(bet)) {
    console.error(LOG_TAG, 'Bet is not tradeable');
    throw new Error('No further action can be performed on an event/bet that has ended!');
  }

  const user = await userService.getUserById(userId);

  if (!user) {
    console.error(LOG_TAG, `User not found with id ${userId}`);
    throw new Error('User not found');
  }

  const response = {
    bet,
    trade: {},
  };

  const session = await Bet.startSession();
  try {
    await session.withTransaction(async () => {
      const betContract = new BetContract(betId, bet.outcomes.length);

      console.debug(LOG_TAG, 'Interacting with the AMM');

      await betContract.buy(userId, amount, outcome, minOutcomeTokensToBuy * WFAIR.ONE);

      console.debug(LOG_TAG, 'Successfully bought Tokens');

      const potentialReward = await betContract.calcBuy(amount, outcome);

      const trade = new Trade({
        userId: user._id,
        betId: bet._id,
        outcomeIndex: outcome,
        investmentAmount: toPrettyBigDecimal(amount),
        outcomeTokens: toPrettyBigDecimal(potentialReward),
      });

      response.trade = await trade.save({ session });

      console.debug(LOG_TAG, 'Trade saved successfully');
    });

    await eventService.placeBet(user, bet, toPrettyBigDecimal(amount), outcome);
    return response;
  } catch (err) {
    console.error(LOG_TAG, err);
    throw new Error('Unexpected error ocurred while placing bet');
  } finally {
    await session.endSession();
  }
};

exports.getTrade = async (id) => {
  return await Trade.findById(id).populate('userId').populate('betId');
}

exports.clearOpenBets = async (bet, session) => {
  const betContract = new BetContract(bet.id, bet.outcomes.length);
  for (const outcome of bet.outcomes) {
    const wallets = await betContract.getInvestorsOfOutcome(outcome.index);
    const win = outcome.index === +bet.finalOutcome;

    for (const wallet of wallets) {
      const userId = wallet.owner;

      if (userId.startsWith('BET')) {
        continue;
      }

      await tradeService.closeTrades(
        userId,
        bet,
        outcome.index,
        win ? 'rewarded' : 'closed',
        session
      );
    }
  }
};

exports.refundUserHistory = async (bet, session) => {
  const userIds = [];
  const betContract = new BetContract(bet.id, bet.outcomes.length);

  for (const outcome of bet.outcomes) {
    const wallets = await betContract.getInvestorsOfOutcome(outcome.index);

    for (const wallet of wallets) {
      const userId = wallet.owner;

      if (userId.startsWith('BET')) {
        continue;
      }

      if (!userIds.includes(userId)) {
        userIds.push(userId);
      }

      await tradeService.closeTrades(userId, bet, outcome.index, 'closed', session);
    }
  }

  return userIds;
};

exports.automaticPayout = async (winningUsers, bet) => {
  // Payout finalOutcome
  for (const userId of winningUsers) {
    await userService.payoutUser(userId, bet);
  }
};

exports.resolve = async ({
  betId,
  outcomeIndex,
  evidenceActual,
  evidenceDescription,
  reporter,
}) => {
  const LOG_TAG = '[RESOLVE-BET]';

  const bet = await eventService.getBet(betId);
  const event = await Event.findById(bet.event);

  if (bet.status !== 'active' && bet.status !== 'closed') {
    throw new Error('Event can only be resolved if it is active or closed');
  }
  console.debug(LOG_TAG, 'Resolving Bet', { betId, reporter, outcomeIndex });

  let resolveResults = [];
  let ammInteraction = [];

  const session = await Bet.startSession();
  try {
    await session.withTransaction(async () => {
      bet.finalOutcome = outcomeIndex;
      bet.resolved = true;
      bet.evidenceDescription = evidenceDescription;
      bet.evidenceActual = evidenceActual;

      await this.clearOpenBets(bet, session);
      await bet.save({ session });
      const betContract = new BetContract(betId);
      resolveResults = await betContract.resolveAndPayout(
        reporter,
        outcomeIndex
      );
      ammInteraction = await betContract.getUserAmmInteractions();
    });
  } catch (err) {
    console.debug(err);
  } finally {
    await session.endSession();

    // find out how much each individual user invested
    const investedValues = {}; // userId -> value
    for (const interaction of ammInteraction) {
      const amount = Number(interaction.amount) / Number(WFAIR.ONE);
      if (interaction.direction === 'BUY') {
        // when user bought, add this amount to value invested
        investedValues[interaction.buyer] = investedValues[interaction.buyer]
          ? investedValues[interaction.buyer] + amount
          : amount;
      } else if (interaction.direction === 'SELL') {
        // when user sells, decrease amount invested
        investedValues[interaction.buyer] =
          investedValues[interaction.buyer] - amount;
      }
    }
    console.log(LOG_TAG, 'Finding investments', investedValues);

    for (const resolvedResult of resolveResults) {
      const userId = resolvedResult.owner;
      const { balance } = resolvedResult;

      const winToken = Math.round(Number(balance) / Number(WFAIR.ONE));

      if (userId.includes('_')) {
        continue;
      }

      console.log(LOG_TAG, 'Awarding winnings', {userId, winToken});

      // update the balance of tokens won of a user, to be used for leaderboards
      // must be done inside transaction
      await userService.increaseAmountWon(userId, winToken);

      // send notification to this user
      return websocketService.emitBetResolveNotification( // eslint-disable-line no-unsafe-finally
        userId,
        betId,
        bet.marketQuestion,
        bet.outcomes[outcomeIndex].name,
        Math.round(investedValues[userId]),
        event.previewImageUrl,
        winToken
      );
    }
  }
}
