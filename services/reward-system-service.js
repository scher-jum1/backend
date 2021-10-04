const {Reward, User, UniversalEvent} = require('@wallfair.io/wallfair-commons').models;
const pick = require('lodash.pick');
const bcrypt = require('bcrypt');
const axios = require('axios');
const {publishEvent} = require('./notification-service');
const {
  notificationEvents,
  DEFAULT_CHANNEL,
  publishToBroadcast
} = require("../services/notification-service");

exports.createReward = async (data, options = {}) => {
  const eventStructure = {
    type: notificationEvents.EVENT_USER_REWARDED,
    userId: data.userId,
    performedBy: 'user',
    channel: DEFAULT_CHANNEL,
    data
  };

  //create reward event type in universalEvent collection
  await UniversalEvent.create(eventStructure).catch((err) => {
    console.error(err);
  })

  //publish to broadcast, this should be dedicated message just for user
  publishToBroadcast({
    event: eventStructure.type, data: {
      data
    }
  });
};

exports.upsertReward = async (filter = {}, data, options = {}) => {
  return UniversalEvent.findOneAndUpdate(filter, {$set: data}, {
    lean: true,
    'new': true,
    upsert: true,
    ...options
  });
};

exports.getUserRewards = async (filter = {}, projection, options = {lean: true}) => {
  return UniversalEvent.find(filter, projection, options);
};

exports.getUniversalEvents = async (filter = {}, projection, options = {lean: true}) => {
  return UniversalEvent.find(filter, projection, options);
};

exports.getUserData = async (id) => {
  return User.findOne({_id: id}, null, {lean: true});
};

exports.updateUserTrackers = async (userId, data) => {
  return User.findOneAndUpdate(
    {_id: userId},
    data,
    {new: true, lean: true}
  );
};
