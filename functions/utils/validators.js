/////
//Helper functions
/////
const isEmptyString = (string) => {
  if (string.trim() === '') return true;
  else return false;
};

const isEmptyArray = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return true;
  else return false;
};

const isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
};

const isEmail = (email) => {
  const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(emailRegEx)) return true;
  else return false;
};

/////
// Menu routes
/////
exports.validateItemChanges = (data) => {
  let previewFields = [
    'name',
    'description',
    'price',
    'thumbnailUrl',
    'active',
  ];
  let toBeUpdatedPreviewFields = {};
  let errors = {};

  if (isEmptyObject(data)) {
    errors.itemDetails = 'Must be non-empty object';
  } else {
    const inputFields = Object.keys(data);
    if (inputFields.includes('itemId')) {
      errors.itemId = 'Item id cannot be changed';
    } else {
      previewFields = previewFields.filter((element) =>
        inputFields.includes(element)
      );
      previewFields.forEach((field) => {
        toBeUpdatedPreviewFields[field] = data[field];
      });
    }
  }

  return {
    errors,
    toBeUpdatedPreviewFields,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateItemListData = (data) => {
  let errors = {};
  if (isEmptyArray(data.itemList)) errors.itemList = 'Must not be empty';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateCategoryData = (data) => {
  let errors = {};

  if (isEmptyString(data.name)) errors.name = 'Must not be empty';
  if (isEmptyObject(data.itemList)) errors.itemList = 'Must not be empty';
  if (isEmptyString(data.letter)) errors.letter = 'Must assign a letter';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

/////
// Order routes
/////
exports.validateOrderData = (data) => {
  let errors = {};

  if (isEmptyString(data.senderId))
    errors.senderId = 'Cannot verify the sender';
  if (isEmptyObject(data.contact)) errors.contact = 'Must not be empty';
  if (isEmptyArray(data.itemList)) errors.itemList = 'Must not be empty';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};
exports.validateDineInOrderData = (data) => {
  let errors = {};

  if (isEmptyString(data.table)) errors.table = 'Must not be empty';
  if (isEmptyArray(data.itemList)) errors.itemList = 'Must not be empty';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateOrderChanges = (data) => {
  let errors = {};

  if (data.orderId) {
    errors.orderId = 'Cannot change orderId';
  }
  if (data.status == 'CLOSED') {
    errors.status =
      "Please do not change the order status to 'CLOSED' directly. Please close the order properly.";
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

/////
// User routes
/////
exports.validateSignUpData = (data) => {
  let errors = {};

  if (!isEmail(data.email)) errors.email = 'Must provide valid email address';
  if (isEmptyString(data.password)) errors.password = 'Must not be empty';
  if (data.password !== data.confirmPassword)
    errors.confirmPassword = 'Password must match';
  if (data.role <= data.maxRole)
    errors.role = 'Need higher authorized user to grant permission';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateSignInData = (data) => {
  let errors = {};

  if (!isEmail(data.email)) errors.email = 'Must provide valid email address';
  if (isEmptyString(data.password)) errors.password = 'Must not be empty';

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};
