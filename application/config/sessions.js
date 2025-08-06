({
  sid: 'token',
  characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  length: 64,
  secret: '0vcXNZc57WhMvnFcsfpDtr2au7DgZ5J9lZFObtWqeD6KAD3k9XEgyQyoDHFFefaf',
  regenerate: 60 * 60 * 1000,
  expire: 2 * 60 * 60 * 1000,
  persistent: true,
  limits: {
    ip: 20,
    user: 5,
  },
});
