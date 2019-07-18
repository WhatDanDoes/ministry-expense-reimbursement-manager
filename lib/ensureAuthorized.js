/**
 * 2019-7-18 https://stackoverflow.com/questions/17756848/only-allow-passportjs-authenticated-users-to-visit-protected-page
 */
function ensureAuthorized(req, res, next) {
  if (req.isAuthenticated()) { 
    return next();
  }
  res.redirect('/')
}

module.exports = ensureAuthorized;
