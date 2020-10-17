const functions = require('firebase-functions');
const app = require('express')();
const cors = require('cors');

app.use(cors());

const { db } = require('./utils/admin');
const isAuthenticated = require('./utils/isAuthenticated');
const isAuthorized = require('./utils/isAuthorized');
const {
  addItemToCategory,
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteItemFromCategory,
  deleteItem,
  getActiveMenu,
  getAllItems,
  getAllMenu,
  getItem,
  updateCategory,
  updateItemDetails,
  uploadImage,
} = require('./handlers/menu');
const {
  authSignUp,
  getGuestDetails,
  getTargetGuestDetails,
  getTargetUserDetails,
  getUserDetails,
  markNotificationsRead,
  signIn,
  signOut,
  signUp,
  anonymousSignIn,
  anonymousUpgrade,
} = require('./handlers/users');
const {
  addToOrder,
  closeOrder,
  deleteOrder,
  getDineInOrder,
  getOpenOrders,
  getOrder,
  getOrders,
  sendDineInOrder,
  sendOrder,
  updateOrder,
} = require('./handlers/orders');
const { dailyReport, monthlyReport } = require('./handlers/reports');
const {
  getAnnouncement,
  postAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('./handlers/notifications');

/////
// Menu routes - Guest
/////
app.get('/menu', getActiveMenu);

/////
// Menu routes - Admin
/////
app.get('/menu/all', isAuthenticated, isAuthorized(2), getAllMenu);
app.get('/menu/item/:itemId', isAuthenticated, isAuthorized(3), getItem);
app.get('/menu/items', isAuthenticated, isAuthorized(2), getAllItems);
app.post('/menu/item/create', isAuthenticated, isAuthorized(2), createMenuItem);
app.post(
  '/menu/item/:itemId/update',
  isAuthenticated,
  isAuthorized(2),
  updateItemDetails
);
app.post(
  '/menu/item/:itemId/update-image/',
  isAuthenticated,
  isAuthorized(2),
  uploadImage
);
app.post(
  '/menu/category/create',
  isAuthenticated,
  isAuthorized(2),
  createCategory
);
app.post(
  '/menu/category/:catId',
  isAuthenticated,
  isAuthorized(2),
  updateCategory
);
app.post(
  '/menu/category/addItem/:catId',
  isAuthenticated,
  isAuthorized(2),
  addItemToCategory
);
app.delete('/menu/:itemId', isAuthenticated, isAuthorized(1), deleteItem);
app.delete(
  '/menu/category/deleteItem/:catId',
  isAuthenticated,
  isAuthorized(1),
  deleteItemFromCategory
);
app.delete(
  '/menu/category/:catId',
  isAuthenticated,
  isAuthorized(1),
  deleteCategory
);

/////
// Order routes - Guest
/////
app.get('/order/:orderId', isAuthenticated, getOrder);
// TODO: if server ordered take out over the phone, we can email confirmation with link for tracking the progress
app.post('/order', isAuthenticated, sendOrder);
// DINE-IN
app.get('/order/dine-in/:orderId', getDineInOrder);
app.post('/order/dine-in', sendDineInOrder);
app.post('/order/dine-in/update/:orderId', addToOrder);

/////
// Order routes - Admin
/////
app.get('/orders', isAuthenticated, isAuthorized(3), getOpenOrders);
app.get(
  '/orders/search/:startingTime/to/:endingTime',
  isAuthenticated,
  isAuthorized(3),
  getOrders
);
app.post(
  '/order/update/:orderId',
  isAuthenticated,
  isAuthorized(3),
  updateOrder
);
app.post('/order/pay/:orderId', isAuthenticated, isAuthorized(3), closeOrder);
app.delete('/orders/delete', isAuthenticated, isAuthorized(2), deleteOrder);

/////
// Report routes - Admin
/////
app.get(
  '/report/daily/:startingTime/to/:endingTime',
  isAuthenticated,
  isAuthorized(3),
  dailyReport
);
app.get(
  '/report/monthly/:startingDate/to/:endingDate',
  isAuthenticated,
  isAuthorized(3),
  monthlyReport
);

/////
// User routes - Guest
/////
app.get('/guest', isAuthenticated, getGuestDetails);
app.get('/anonymous', anonymousSignIn);
app.post('/anonymous/upgrade', anonymousUpgrade);
app.post('/guest/signUp', signUp);
app.post('/signIn', signIn);
app.post('/signOut', signOut);

/////
// User routes - Admin
/////
app.get('/user', isAuthenticated, isAuthorized(3), getUserDetails);
app.get(
  '/user/:userId',
  isAuthenticated,
  isAuthorized(2),
  getTargetUserDetails
);
app.get(
  '/user/guest/:guestId',
  isAuthenticated,
  isAuthorized(3),
  getTargetGuestDetails
);
app.post('/user/signUp', isAuthenticated, isAuthorized(2), authSignUp);
app.post(
  '/user/notifications',
  isAuthenticated,
  isAuthorized(3),
  markNotificationsRead
);

/////
// Admin routes - Admin
/////
// TODO: Fetch and update settings, such as store hours/tax rates/default tip suggestions.

exports.api = functions.https.onRequest(app);

/////
// Notification routes
/////
app.get(
  '/notification/announcement',
  isAuthenticated,
  isAuthorized(3),
  getAnnouncement
);
app.post(
  '/notification/announcement/announce',
  isAuthenticated,
  isAuthorized(2),
  postAnnouncement
);
app.post(
  '/notification/announcement/:annId',
  isAuthenticated,
  isAuthorized(2),
  updateAnnouncement
);
app.delete(
  '/notification/announcement/delete/:annId',
  isAuthenticated,
  isAuthorized(2),
  deleteAnnouncement
);

/////
// Firebase triggers
/////
exports.createNotificationOnAnnouncement = functions.firestore
  .document('announcements/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .set({
        createdAt: new Date().toDateString(),
        content: snapshot.data().content,
        sender: snapshot.data().sender,
        type: 'announcement',
        read: false,
        announcementId: snapshot.id,
      })
      .catch((err) => {
        console.error(err);
      });
  });

// exports.updateNotificationOnAnnouncement = functions.firestore
//   .document('announcements/{id}')
//   .onUpdate((change) => {
//     let updatedAnnouncement = change.after.data();
//     updatedAnnouncement.createdAt = new Date().toDateString();

//     return db
//       .doc(`/notifications/${change.before.data().announcementId}`)
//       .update(updatedAnnouncement)
//       .catch((err) => {
//         console.error(err);
//       });
//   });

// TODO: Auto delete after 30days

// Delete the notification when the announcement is deleted
// exports.deleteNotificationOnAnnouncement = functions.firestore
//   .document('announcements/{id}')
//   .onDelete((snapshot) => {
//     return db
//       .doc(`/notifications/${snapshot.id}`)
//       .delete()
//       .catch((err) => {
//         console.error(err);
//       });
//   });
