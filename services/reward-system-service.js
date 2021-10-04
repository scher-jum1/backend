const {Reward, User, UniversalEvent} = require('@wallfair.io/wallfair-commons').models;
const pick = require('lodash.pick');
const bcrypt = require('bcrypt');
const axios = require('axios');
const {publishEvent} = require('./notification-service');

exports.createReward = async (data, options = {}) => {
  return Reward.create(data);
};

exports.upsertReward = async (filter = {}, data, options = {}) => {
  return Reward.findOneAndUpdate(filter, {$set: data}, {
    lean: true,
    'new': true,
    upsert: true,
    ...options
  });
};

exports.getUserRewards = async (filter = {}, projection, options = {lean: true}) => {
  return Reward.find(filter, projection, options);
};

exports.getUniversalEvents = async (filter = {}, projection, options = {lean: true}) => {
  return UniversalEvent.find(filter, projection, options);
};

exports.getUserData = async (id) => {
  return User.findOne({ _id: id }, null, {lean: true});
};

exports.updateUserTrackers = async (userId, data) => {
  return User.findOneAndUpdate(
    { _id: userId },
    data,
    { new: true, lean: true }
  );
};

exports.getUsersLeaderboard = () => {

  console.log("User", User);



    // return new Promise(async (resolve, reject) => {
    //   const users = await User.find({ username: { $exists: true } })
    //     .sort({ amountWon: -1, username: 1 })
    //     .select({ _id: 1, amountWon: 1 })
    //     .exec();
    //
    //   resolve(users)
    // })
};
