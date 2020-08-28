const { admin } = require('./admin');

module.exports = (req, res, next) => {
  let idToken;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    idToken = req.headers.authorization.split('Bearer ')[1] || '';
  } else {
    console.error('No token found');
    return res.status(400).json('Unauthenticated');
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      req.user = decodedToken;

      return next();
    })
    .catch((err) => {
      console.error('Something went wrong while decoding the token ', err);
      return res.status(400).json(err);
    });
};
