#! /usr/bin/env node

var RtmClient = require('@slack/client').RtmClient;
var WebClient = require('@slack/client').WebClient;
var MemoryDataStore = require('@slack/client').MemoryDataStore;

var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var util = require('util')
var notifier = require('node-notifier');
var path = require('path');
var moment = require('moment');
var chalk = require('chalk');
var minimist = require('minimist');

var argv = minimist(process.argv.slice(2));

var CONFIG = {
  SHOW_ME: false,
  TOKEN: '',
  DEST_TOKEN: '',
  MY_USERNAME: null,
};

if (argv.help || argv.h || argv.usage) {
  const usage = `
  --me     : Send notification when your presence changes (could be useful when network goes off/on).
  --token  : Set your per team slack token, information on how to get a token
             can be found here (https://api.slack.com/docs/oauth-test-tokens).
  --dest_token: The token used to notify a channel or user
  --dest_channel: The channel to notify
  --users  : Comma delimited list of usernames to monitor ex: isaac-mosquera, kevinwoo, andrewbackes
  --help   : to show this information.
  `;
  console.log(usage);
}

if (argv.token && argv.token !== '') {
  CONFIG.TOKEN = argv.token;
  CONFIG.DEST_TOKEN = argv.dest_token;
}

if (argv.me) {
  CONFIG.SHOW_ME = true;
}

function createRTM(token, destToken) {
  var rtm = new RtmClient(token, { logLevel: 'error', dataStore: new MemoryDataStore() });
  console.log("logging to " + argv.dest_channel + ' with token:' + destToken);
  var destClient= new WebClient(destToken, { logLevel: 'error', dataStore: new MemoryDataStore() });
  destClient.registerDataStore(new MemoryDataStore());
  rtm.start();


  rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
    CONFIG.MY_USERNAME = rtmStartData.self.name;
    console.info('- ', chalk.blue(moment().format('LLLL'),' Logged in as', CONFIG.MY_USERNAME, '\n\n'));
  });

  let users = argv.users.toUpperCase().split(",");
  let user_set = new Set(users);

  for(var u of user_set) { console.log('|' + u + '|'); }

  rtm.on(RTM_EVENTS.MESSAGE, function(data) {
    console.info("data: " + util.inspect(data));

    ignorable_messages = new Set(['message_replied','bot_message', 'message_changed']);
    if (ignorable_messages.has(data.subtype)) {
      console.info("Ignoring message: "+ data.subtype);
      return;
    }

    let user = rtm.dataStore.getUserById(data.user);
    let channel = rtm.dataStore.getChannelById(data.channel);
    var channelInfo = "";
    if (channel != undefined) {
      channelInfo = " in the channel: " + channel.name;
    }

    //console.info("user: " + util.inspect(user));
    var message = user.name.toUpperCase() + ' just asked a question in Spinnaker Slack' + channelInfo
    var notification = {
      'title': 'Slack',
      'message':  user.name.toUpperCase() + ' just asked a question in Spinnaker Slack' + channelInfo,
      'sound': false,
      'icon': path.join(__dirname, 'slack.png'),
    };

    if (user_set.has(user.profile.email.toUpperCase())) {
      console.info("showing")
      notifier.notify(notification);

      destClient.chat.postMessage(argv.dest_channel, message, function(err, res) {
        if (err) {
            console.log('Error:', err);
        } else {
            console.log('Message sent: ', res);
        }
      });

    } else {
      console.info("not showing: " + user.name, user.profile.email)
    }
  });

  // rtm.on(RTM_EVENTS.PRESENCE_CHANGE, function(data) {
  //   var status = { 'active': 'online', 'away': 'offline' };
  //   var user = rtm.dataStore.getUserById(data.user);
  //
  //   if (user.name === CONFIG.MY_USERNAME && CONFIG.SHOW_ME) {
  //     user.name = 'You';
  //   }
  //
  //   var activity = { presence: data.presence, username: user.name };
  //   var notification = {
  //     'title': 'Slack',
  //     'message':  activity.username[0].toUpperCase() + activity.username.substr(1) + ' just went ' + status[activity.presence],
  //     'sound': false,
  //     'icon': path.join(__dirname, 'slack.png'),
  //   };
  //
  //   if (user_set.has(activity.username) || activity.username !== CONFIG.MY_USERNAME || activity.username === CONFIG.MY_USERNAME && CONFIG.SHOW_ME) {
  //     notifier.notify(notification);
  //   };
  //
  //   var log = `{ ${chalk.bold.green('user')}: '${activity.username}', ${chalk.bold.green('presence')}: '${activity.presence}' }`;
  //
  //   console.info('- ', chalk.blue(moment().format('LLLL')), chalk.bold(' PRESENCE_CHANGE:'), log);
  // });
}

// Invoke this function with a token for each slack team
// Grab the token from here : https://api.slack.com/docs/oauth-test-tokens
if (!CONFIG.TOKEN || CONFIG.TOKEN === '') {
  console.log('Error: Missing token');
  process.exit();
};

createRTM(CONFIG.TOKEN, CONFIG.DEST_TOKEN);
