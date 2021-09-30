const flat = require('flat');

//for createdAt/updatedAt mongo queries
const prepareTimeRange = (type) => {
  if (type.toLowerCase() === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return {
      start, end
    }
  }
}

//prepare object in dot notation, for mongo query update task
const flatThis = (dataObj) => {
  return flat(dataObj, { safe: true });
}

module.exports = {
  prepareTimeRange,
  flatThis
};
