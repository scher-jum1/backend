const logger = require('../util/logger');
const userApi = require('../services/user-api');
const { ErrorHandler } = require('../util/error-handler');
const authService = require('../services/auth-service');
const { validationResult } = require('express-validator');
const userService = require('../services/user-service');
const { generate } = require('../helper');
const bcrypt = require('bcryptjs');
const { publishEvent, notificationEvents } = require('../services/notification-service');
const {checkDirectEvents} = require("../controllers/rewards-system-controller");


module.exports = {
  async createUser(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler(422, errors));
    }

    try {
      const { password, email, username } = req.body;

      const existing = await userApi.getUserByIdEmailPhoneOrUsername(email);

      if (existing) {
        return next(new ErrorHandler(400, 'User exists'));
      }

      const counter = ((await userApi.getUserEntriesAmount()) || 0) + 1;
      const passwordHash = await bcrypt.hash(password, 8);

      const createdUser = await userApi.createUser({
        email,
        username: username || `wallfair-${counter}`,
        password: passwordHash,
        preferences: {
          currency: 'WFAIR',
        },
      });

      await userService.mintUser(createdUser.id.toString());

      const prepareEventMsg = {
        event: notificationEvents.EVENT_USER_SIGNED_UP,
        data: {
          producer: 'user',
          producerId: createdUser._id,
          data: { email: createdUser.email, username: createdUser.username },
        }
      }

      publishEvent(prepareEventMsg.event, prepareEventMsg.data);

      //additional event, only when user provide a birthdate, we need similar handler, when user update the profile as well
      if(process.env.ENABLE_REWARD_SYSTEM) {
        const birthdateGiven = _.get(createdUser, 'birthdate');

        if(birthdateGiven) {
          const prepareEventMsg = {
            event: notificationEvents.EVENT_USER_BIRTH_DATE_GIVEN,
            data: {
              producer: 'user',
              producerId: createdUser._id,
              data: {
                birthdate: birthdateGiven,
                email: createdUser.email,
                username: createdUser.username
              }
            }
          }

          publishEvent(prepareEventMsg.event, prepareEventMsg.data);

          await checkDirectEvents(prepareEventMsg).catch((err)=> {
            console.error('[Reward system err]', err);
          })
        }
      }

      return res.status(201).json({
        userId: createdUser.id,
        email: createdUser.email,
      });
    } catch (err) {
      logger.error(err);
    }
    return res.status(500).send();
  },

  async login(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler(422, errors));
    }

    try {
      const { userIdentifier, password } = req.body;
      const user = await userApi.getUserByIdEmailPhoneOrUsername(userIdentifier);
      const valid = user && (await bcrypt.compare(password, user.password));

      if (!valid) {
        return next(new ErrorHandler(401, 'Invalid login'));
      }

      const prepareEventMsg = {
        event: notificationEvents.EVENT_USER_SIGNED_IN,
        data: {
          producer: 'user',
          producerId: user._id,
          data: { userIdentifier },
        },
      }

      publishEvent(prepareEventMsg.event, prepareEventMsg.data);

      if(process.env.ENABLE_REWARD_SYSTEM) {
        checkDirectEvents(prepareEventMsg).catch((err)=> {
          console.error('[Reward system err]', err);
        })
      }

      res.status(200).json({
        userId: user.id,
        session: await authService.generateJwt(user),
      });
    } catch (err) {
      logger.error(err);
      return next(new ErrorHandler(401, "Couldn't verify user"));
    }
  },

  async verifyEmail(req, res, next) {
    try {
      const user = await userApi.verifyEmail(req.body.email);
      if (!user) return next(new ErrorHandler(404, "Couldn't find user"));
      return res.status(200).send();
    } catch (err) {
      logger.error(err);
      return res.status(500).send();
    }
  },

  /** Handler to acutally reset your password */
  async resetPassword(req, res, next) {
    try {
      // get user
      const user = await userApi.getUserByIdEmailPhoneOrUsername(req.body.email);
      if (!user) return next(new ErrorHandler(404, "Couldn't find user"));

      // check if token matches
      if (user.passwordResetToken !== req.body.passwordResetToken) {
        return next(new ErrorHandler(401, "Token not valid"));
      }

      // check if email matches
      if (user.email !== req.body.email) {
        return next(new ErrorHandler(401, "Emails do not match"));
      }

      // check if given passwords match
      if (req.body.password !== req.body.passwordConfirmation) {
        return next(new ErrorHandler(401, "Passwords do not match"));
      }

      const passwordHash = await bcrypt.hash(req.body.password, 8);
      // actually update user
      const updatedUser = await userApi.updateUser({
        id: user.id,
        password: passwordHash,
        $unset: { passwordResetToken: 1 }
      })

      publishEvent(notificationEvents.EVENT_USER_CHANGED_PASSWORD, {
        id: updatedUser._id,
        email: updatedUser.email,
        passwordResetToken: updatedUser.passwordResetToken
      });

      return res.status(200).send();
    } catch (err) {
      logger.error(err);
      return res.status(500).send();
    }
  },


  /** Hanlder to init the "I've forgot my passwort" process */
  async forgotPassword(req, res, next) {
    try {
      const user = await userApi.getUserByIdEmailPhoneOrUsername(req.body.email);
      if (!user) return next(new ErrorHandler(404, "Couldn't find user"));

      // generate token
      const passwordResetToken = generate(10);
      // store user token
      const updatedUser = await userApi.updateUser({ id: user._id, passwordResetToken: passwordResetToken });

      const resetPwUrl = `${process.env.CLIENT_URL}/reset-password?email=${user.email}&passwordResetToken=${passwordResetToken}`

      publishEvent(notificationEvents.EVENT_USER_FORGOT_PASSWORD, {
        id: updatedUser._id,
        email: updatedUser.email,
        passwordResetToken: updatedUser.passwordResetToken,
        resetPwUrl,
      });

      return res.status(200).send();
    } catch (err) {
      logger.error(err);
      return res.status(500).send();
    }
  },
};
