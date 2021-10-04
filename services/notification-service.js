const { UniversalEvent } = require('@wallfair.io/wallfair-commons').models;
const {
  notificationEvents, universalEventTypes
} = require('@wallfair.io/wallfair-commons/constants/eventTypes');

let pubClient;
const DEFAULT_CHANNEL = 'system';

const init = (pub) => {
  pubClient = pub.duplicate();
};

const saveEvent = (event, message) => {
  let uniEvent = new UniversalEvent({
    type: event,
    performedBy: message.producer,
    userId: message.producerId,
    channel: DEFAULT_CHANNEL,
    data: message.data,
  });

  uniEvent.save();
};

const publishOnDefaultChannel = ({event, data})=> {
  console.log('[NOTIFICATION-SERVICE] Published:', event);
  pubClient.publish(
    DEFAULT_CHANNEL,
    JSON.stringify({
      event: event,
      ...data
    })
  );
};

const publishToBroadcast = ({event, data})=> {
  pubClient.publish(
    'message',
    JSON.stringify({
      to: '*',
      event,
      date: new Date(),
      ...data,
    })
  );
};

const publishEvent = (event, data) => {
  if (universalEventTypes.includes(event)) {
    saveEvent(event, data);
  }

  publishOnDefaultChannel({event, data});

  if (data.broadcast) {
    publishToBroadcast({event, data});
  }
};

module.exports = {
  init,
  publishEvent,
  notificationEvents,
  publishOnDefaultChannel,
  publishToBroadcast,
  saveEvent,
  DEFAULT_CHANNEL
};
