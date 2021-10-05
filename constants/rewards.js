// possible categories = ['badge', 'easter_egg', 'milestone', 'general'];

module.exports = {
  rewardTypes: {
    'ON_DAILY_LOGIN': {
      type: 'ON_DAILY_LOGIN',
      singleActionReward: 50,
      maxReward: 5000,
      category: 'general'
    },
    'ON_SIGNED_UP_BY_FRIEND': {
      type: 'ON_SIGNED_UP_BY_FRIEND',
      singleActionReward: 1000,
      maxReward: 10000,
      category: 'general'
    },
    'ON_SIGNED_UP_BY_INFLUENCER': {
      type: 'ON_SIGNED_UP_BY_INFLUENCER',
      singleActionReward: 7500,
      maxReward: 7500,
      category: 'general',
      influencers: ['influencer1', 'influencer2']
    },
    'ON_SHARED_LINK_FIRST_VISIT': {
      type: 'ON_SHARED_LINK_FIRST_VISIT',
      singleActionReward: 500,
      maxReward: 500,
      category: 'general'
    },
    //for later
    'ON_CAROUSEL_FEEDBACK_ANSWERED': {
      type: 'ON_CAROUSEL_FEEDBACK_ANSWERED',
      singleActionReward: 1000,
      maxReward: 1000,
      category: 'general'
    },
    //for later
    'ON_WENT_BACK_AFTER_INACTIVITY': {
      type: 'ON_WENT_BACK_AFTER_INACTIVITY',
      singleActionReward: 200,
      maxReward: 200,
      category: 'general'
    },
    //EASTER EGGS
    'ON_BETTED_MAX_STAKE_IN_ROW': {
      type: 'ON_BETTED_MAX_STAKE_IN_ROW',
      singleActionReward: 500,
      maxReward: 500,
      category: 'easter_egg'
    },
    'ON_GAME_PLAYED': {
      type: 'ON_GAME_PLAYED',
      category: 'easter_egg',
      games: {
        rosiGame: {
          singleActionReward: 500,
          maxReward: 500
        }
      }
    },
    'ON_GAME_PLAYED_X_DAYS_IN_ROW': {
      type: 'ON_GAME_PLAYED_X_DAYS_IN_ROW',
      category: 'easter_egg',
      singleActionReward: 500,
      maxReward: 500,
      daysInRow: 6
    },
    'ON_USER_WAS_ACTIVE_LONG_TIME': {
      type: 'ON_USER_WAS_ACTIVE_LONG_TIME',
      singleActionReward: 200,
      maxReward: 200,
      timeInHours: 4,
      category: 'easter_egg'
    },
    'ON_BIRTHDATE_GIVEN': {
      type: 'ON_BIRTHDATE_GIVEN',
      singleActionReward: 200,
      maxReward: 200,
      category: 'easter_egg'
    },
    'ON_CHECKED_IN_MANY_CHATS': {
      type: 'ON_CHECKED_IN_MANY_CHATS',
      singleActionReward: 300,
      maxReward: 300,
      totalChats: 20,
      category: 'easter_egg'
    },
    'ON_BETTED_IN_SICK_SOCIETY_CAT': {
      type: 'ON_BETTED_IN_SICK_SOCIETY_CAT',
      singleActionReward: 300,
      maxReward: 300,
      totalBets: 10,
      betCategory: 'Sick Society',
      category: 'easter_egg'
    },
    'ON_FEEDBACK_PROVIDED': {
      type: 'ON_FEEDBACK_PROVIDED',
      singleActionReward: 500,
      maxReward: 500,
      category: 'easter_egg'
    }
  }

}
