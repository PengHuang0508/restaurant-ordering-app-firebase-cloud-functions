const { db } = require('./admin');

module.exports = (allowedRole) => (req, res, next) => {
  db.collection('users')
    .where('userId', '==', req.user.uid)
    .limit(1)
    .get()
    .then((doc) => {
      if (doc.size == 0) {
        return res.status(404).json('User not found.');
      } else {
        req.user.handle = doc.docs[0].data().handle;
        req.user.role = doc.docs[0].data().role;

        if (allowedRole >= req.user.role) {
          return next();
        } else {
          console.error('Permission denied.');
          return res.status(403).json('Permission denied.');
        }
      }
    })
    .catch((err) => {
      console.error('Something went wrong while retrieving user data ', err);
      return res.status(400).json(err);
    });
};
