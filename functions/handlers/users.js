const firebase = require('firebase');
const firebaseConfig = require('../utils/firebaseConfig');

firebase.initializeApp(firebaseConfig);

const { db } = require('../utils/admin');
const {
  validateSignUpData,
  validateSignInData,
} = require('../utils/validators');
const auth = firebase.auth();

/////
// Roles
/////
// Admin   0
// Owner   1
// Manager 2
// Server  3
// Guest   4

/////
// Guest
/////
exports.anonymousSignIn = (req, res) => {
  auth
    .signInAnonymously()
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.anonymousUpgrade = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: 4,
    maxRole: 3,
  };
  const { valid, errors } = validateSignUpData(newUser);

  if (!valid) return res.status(400).json(errors);

  const credential = firebase.auth.EmailAuthProvider.credential(
    newUser.email,
    newUser.password
  );
  let token, userId;

  auth.currentUser
    .linkWithCredential(credential)
    .then((userCred) => {
      userId = userCred.user.uid;

      return userCred.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;

      const userInformation = {
        createdAt: new Date().toISOString(),
        contact: req.body.contact ? req.body.contact : null,
        handle: req.body.contact.firstName
          ? req.body.contact.firstName
          : 'New User',
        email: newUser.email,
        role: newUser.role,
        userId,
      };

      return db.doc(`/guests/${userId}`).set(userInformation);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((err) => {
      console.error('Error upgrading anonymous account', err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getGuestDetails = (req, res) => {
  let userData = {};

  db.doc(`/guests/${req.user.uid}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res
          .status(404)
          .json({ error: 'Failed to retrieve user information.' });
      }

      userData.credentials = doc.data();

      return db
        .collectionGroup('dailyOrders')
        .where('senderId', '==', req.user.uid)
        .get()
        .then((data) => {
          userData.orders = [];
          data.forEach((order) => {
            userData.orders.push(order.data());
          });

          return res.json(userData);
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.signUp = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: 4,
    maxRole: 3,
  };
  const { valid, errors } = validateSignUpData(newUser);

  if (!valid) return res.status(400).json(errors);

  let token, userId;

  auth
    .createUserWithEmailAndPassword(newUser.email, newUser.password)
    .then((data) => {
      userId = data.user.uid;

      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;

      const userInformation = {
        createdAt: new Date().toISOString(),
        contact: req.body.contact ? req.body.contact : null,
        handle: req.body.contact.firstName
          ? req.body.contact.firstName
          : 'New User',
        email: newUser.email,
        role: newUser.role,
        userId,
      };

      return db.doc(`/guests/${userId}`).set(userInformation);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((err) => {
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ signUpEmail: 'Email is already in use' });
      } else if (err.code === 'auth/invalid-email') {
        return res.status(400).json({ signUpEmail: 'Email is not valid.' });
      } else if (err.code === 'auth/weak-password') {
        return res
          .status(400)
          .json({ signUpPassword: 'Password is not strong enough.' });
      } else {
        return res
          .status(500)
          .json({ signUpGeneral: 'Something went wrong. Please try again.' });
      }
    });
};

exports.signIn = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };
  const { valid, errors } = validateSignInData(user);

  if (!valid) return res.status(400).json(errors);

  auth
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((err) => {
      console.error(err);
      if (
        err.code == 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        return res
          .status(403)
          .json({ general: 'Wrong credentials. Please try again.' });
      } else if (err.code == 'auth/invalid-email') {
        return res.status(400).json({ general: 'Email address is not valid.' });
      } else if (err.code == 'auth/user-disabled') {
        return res.status(400).json({
          general:
            'The user corresponding to the given email has been disabled.',
        });
      } else {
        return res.status(500).json({ error: err.code });
      }
    });
};

/////
// Admin
/////
// Email and Password authentication
exports.authSignUp = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: req.body.role,
    maxRole: req.user.role,
  };
  const { valid, errors } = validateSignUpData(newUser);

  if (!valid) return res.status(400).json(errors);

  let token, userId;

  auth
    .createUserWithEmailAndPassword(newUser.email, newUser.password)
    .then((data) => {
      userId = data.user.uid;

      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;

      const userInformation = {
        createdAt: new Date().toISOString(),
        email: newUser.email,
        handle: req.body.handle ? req.body.handle : 'New User',
        role: newUser.role,
        userId,
      };

      return db.doc(`/users/${userId}`).set(userInformation);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((err) => {
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ email: 'Email is already in use' });
      } else if (err.code === 'auth/invalid-email') {
        return res.status(400).json({ email: 'Email is not valid.' });
      } else if (err.code === 'auth/weak-password') {
        return res
          .status(400)
          .json({ email: 'Password is not strong enough.' });
      } else {
        return res
          .status(500)
          .json({ general: 'Something went wrong. Please try again.' });
      }
    });
};

exports.getUserDetails = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.user.uid}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res
          .status(404)
          .json({ error: 'Failed to retrieve user information.' });
      }

      userData.credentials = doc.data();

      return db
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
          userData.notifications = [];
          data.forEach((notification) => {
            userData.notifications.push({
              sender: notification.data().sender,
              read: notification.data().read,
              content: notification.data().message,
              createdAt: notification.data().createdAt,
            });
          });

          return res.json(userData);
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getTargetGuestDetails = (req, res) => {
  let userData = {};
  db.doc(`/guests/${req.params.userId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      userData = doc.data();
      userData.userId = doc.id;
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.getTargetUserDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.params.userId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      userData = doc.data();
      userData.userId = doc.id;
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.markNotificationsRead = (req, res) => {
  let batch = db.batch();

  req.body.forEach((notificationId) => {
    const notificationRef = db.doc(`/notifications/${notificationId}`);
    batch.update(notificationRef, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: 'Notification marked read' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.signOut = (req, res) => {
  auth
    .signOut()
    .then(() => {
      return res.status(200).json({ general: 'Sign-out successful.' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
