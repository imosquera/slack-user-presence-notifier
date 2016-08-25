#! /usr/bin/env node

var RtmClient = require('@slack/client').RtmClient;
var MemoryDataStore = require('@slack/client').MemoryDataStore;

var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var notifier = require('node-notifier');
var path = require('path');
var moment = require('moment');
var chalk = require('chalk');
var minimist = require('minimist');

var argv = minimist(process.argv.slice(2));

var CONFIG = {
  SHOW_ME: false,
  TOKEN: '',
  MY_USERNAME: null,
};

if (argv.help || argv.h || argv.usage) {
  const usage = `
  --me     : Send notification when you change presence yourself.
  --token  : Set slack token, information on how to get a token
             can be found here (https://api.slack.com/docs/oauth-test-tokens).

  --help   : to show this information.
  `;
  console.log(usage);
}

if (argv.token && argv.token !== '') {
  CONFIG.TOKEN = argv.token;
}

if (argv.me) {
  CONFIG.SHOW_ME = true;
}


function createRTM(token) {
  var rtm = new RtmClient(token, { logLevel: 'error', dataStore: new MemoryDataStore() });
  rtm.start();

  rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
    CONFIG.MY_USERNAME = rtmStartData.self.name;
    console.info('- ', chalk.blue(moment().format('LLLL'),' Logged in as', CONFIG.MY_USERNAME, '\n\n'));
  });

  rtm.on(RTM_EVENTS.PRESENCE_CHANGE, function(data) {
    var status = { 'active': 'online', 'away': 'offline' };
    var user = rtm.dataStore.getUserById(data.user);

    if (user.name === CONFIG.MY_USERNAME && CONFIG.SHOW_ME) {
      user.name = 'You';
    }

    var activity = { presence: data.presence, username: user.name };
    var notification = {
      'title': 'Slack',
      'message':  activity.username[0].toUpperCase() + activity.username.substr(1) + ' just went ' + status[activity.presence],
      'sound': true,
      'icon': path.join(__dirname, 'slack.png'),
    };

    if (activity.username !== CONFIG.MY_USERNAME || activity.username === CONFIG.MY_USERNAME && CONFIG.SHOW_ME) {
      notifier.notify(notification);
    };

    var log = `{ ${chalk.bold.green('user')}: '${activity.username}', ${chalk.bold.green('presence')}: '${activity.presence}' }`;

    console.info('- ', chalk.blue(moment().format('LLLL')), chalk.bold(' PRESENCE_CHANGE:'), log);
  });
}

// Invoke this function with a token for each slack team
// Grab the token from here : https://api.slack.com/docs/oauth-test-tokens
if (!CONFIG.TOKEN || CONFIG.TOKEN === '') {
  console.log('Error: Missing token');
  process.exit();
};

createRTM(CONFIG.TOKEN);
