/**
 * 2019-7-18 https://stackoverflow.com/questions/17756848/only-allow-passportjs-authenticated-users-to-visit-protected-page
 */
function ensureAuthorized(req, res, next) {
  if (!req.isAuthenticated()) { 
    req.flash('error', 'You need to login first');
    return res.redirect('/');
  }

  req.user.getReadables((err, readables) => {
    if (err) {
      return next(err);
    }
    req.user.isReader = readables.includes(`${req.params.domain}/${req.params.agentId}`);
    req.user.getWritables((err, writables) => {
      if (err) {
        return next(err);
      }
      req.user.isWriter = writables.includes(`${req.params.domain}/${req.params.agentId}`) ||
                          RegExp(req.user.getAgentDirectory()).test(req.path);

      if (req.user.isReader || req.user.isWriter) {
        return next();
      }
      req.flash('error', 'You are not authorized to access that resource');
      return res.redirect('/');
    });
  });
}

module.exports = ensureAuthorized;
