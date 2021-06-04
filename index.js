// DotEnv (environment variables).
var dotEnv = require('dotenv').config();

// Node.js
var http = require('http');

var weather = require('weather-js');

// MongoDB config
var MongoClient = require('mongodb').MongoClient;
var mongoConnectionUrl = process.env.mongo;

// Prefix for chat commands (!command)
const cmdPrefix = "!";

// Active chat channels that have interacted with TokeBot
var channels = {};

// Discord client config
const discord = require("discord.js");
const discordClient = new discord.Client();
discordClient.login(process.env.discord);

// Fired whenever a chat message is received.
discordClient.on("message", function (msg) {
    if (msg.author.bot) return;

    const channelId = msg.channel.id;

    if (!(channelId in channels)) {
        channels[channelId] = new channel(msg.channel.id, msg.channel.name.toLowerCase());
        createChannelData(msg);
    }

    // All messages should be checked for banned phrases but only messages that start with
    // with the command prefix should be processed as commands.
    channels[channelId].checkForBannedPhrase(msg);
    if (!msg.content.startsWith(cmdPrefix)) return;
    channels[channelId].checkForCmd(msg);
});

// Create or update the channels data in the database.
function createChannelData(msg) {
    MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true }, function (err, db) {
        if (err) throw err;
        var dbo = db.db("tokebot");

        var keys = {
            channel_id: msg.channel.id, channel_name: msg.channel.name
        };
        var values = {
            $setOnInsert: {
                channel_id: msg.channel.id, channel_name: msg.channel.name, guild_id: msg.guild.id,
                guild_name: msg.guild.name, joined: new Date().toLocaleString()
            }
            };
        dbo.collection("channels").updateOne(keys, values, { upsert: true }, function (err, res) {
            if (err) throw err;
            db.close();
        });
    });
}

function channel(channelId, channelName) {
    // Timer for toke sessions
    var tokeTimer;

    // Timer for reminders
    var reminderTimer;

    // Timer to continually check to see if it's 4:20 somwhere.
    var timeCheckTimer = setInterval(checkTime, 60000);

    // Whether or not a session is running
    var sessionRunning = false;

    // Users particpating in the toke session
    var participants = [];

    // Users pariticipating in the toke session "in spirit" (Alternate toke status)
    var spiritTokers = [];

    // Amount of time (in ms) the sesion runs for.
    var sessionInterval = 300000;

    // Amount of time (in ms) between reminders.
    var reminderInterval = 120000;

    // Whether or not the the channel has been initialized.
    var initialized = false;

    // TokeBot commands
    const commands = {
        "toke ping": ping,
        "toke records": postRecords,
        "toke reminder": setReminderInterval,
        "toke users": postTokeParticipants,
        "toke participants": postTokeParticipants,
        "toke end": endSession,
        "tokers": postTokeParticipants,
        "toke": toke,
        "bong": toke,
        "pipe": toke,
        "joint": toke,
        "blunt": toke,
        "dab": toke,
        "smoke": toke,
        "steam": toke,
        "vape": toke,
        "blaze": toke,
        "weed": toke,
        "rosin": toke,
        "live": toke,
        "hash": toke,
        "pot": toke,
        "cannabis": toke,
        "dyna": toke,
        "resin": toke,
        "burn": toke,
        "spliff": toke,
        "chronic": toke,
        "marijuana": toke,
        "bud": toke,
        "concentrate": toke,
        "shatter": toke,
        "wax": toke,
        "cart": toke,
        "dougdimmadab": toke,
        "reefer": toke,
        "420": toke,
        "710": toke,
        "cheba": toke,
        "cheeba": toke,
        "satan": toke,
        "devil": toke,
        "beelzebub": toke,
        "ganja": toke,
        "hemp": toke,
        "leave": toke,
        "leaf": toke,
        "delta 8": toke,
        "delta8": toke,
        "delta9": toke,
        "delta 9": toke,
        "d8": toke,
        "d9": toke,
        "cbd": toke,
        "thc": toke,
        "postmalone": toke,
        "post malone": toke,
        "dagga": toke,
        "magicman": toke,
        "blastoff": toke,
        "boof": toke,
        "mids": toke,
        "topshelf": toke,
        "top shelf": toke,
        "edible": toke,
        "weedible": toke,
        "cookie": toke,
        "brownie": toke,
        "gum": toke,
        "tincture": toke,
        "cbg": toke,
        "cbn": toke,
        "mary": toke,
        "rso": toke,
        "char": toke,
        "loud": toke,
        "gas": toke,
        "kush": toke,
        "toasted": toke,
        "baked": toke,
        "stoned": toke,
        "high": toke,
        "cheers": toke,
        "salud": toke,
        "bake": toke,
        "wake": toke,
        "cooked": toke,
        "fried": toke,
        "suppository": toke,
        "re": toke,
        "baby": toke,
        "hella": toke,
        "chillum": toke,
        "one hitter": toke,
        "onehitter": toke,
        "terp": toke,
        // pretoke is a way of joining a session in advance.
        // Users are added straight to list of participants
        "pre": addParticipant,
        "early": addParticipant,
        "late": addParticipant,
        "spirit": addSpiritToker,
        "weather": postWeather
    };

    // Phrases that will trigger a warning if said
    const bannedPhrases = [
        "lsd",
        "cocaine",
        "mdma",
        "ecstasy",
        "codeine",
        "percocet",
        "vicodin",
        "xanax",
        "heroin",
        "dxm",
        "dmt",
        "pcp"
    ];

    // The first part of a two part reply when a session ends.
    // {sessionReplies1}. {sessionReplies2}.
    var sessionReplies1 = [
        "Toke it up!",
        "Blaze it!",
        "Hits from the bong!",
        "Pass the joint!",
        "Tokers unite!",
        "That's the good stuff!",
        "Dabs for everybody!",
        "Blunts, and bongs, and dabs, Oh my!",
        "Get cyber stoned and download some happiness!",
        "It smells like a Cypress Hill concert in here!",
        "Man that was a good session.",
        "Damn son! Where'd you find this!",
        "I smell it! Let me inhale it!",
        "Damn that's dank!",
        "Did somebody bring munchies?"
    ];

    // The second part of a two part reply when a session ends.
    // {sessionReplies1}. {sessionReplies2}.
    var sessionReplies2 = [
        "Getting stoned with",
        "Toking it up with",
        "Smoking with",
        "Stoned with the homies",
        "That was a nice session with",
        "Blazing with",
        "Burning one with",
        "Getting lit with",
        "Seshing with",
        "Getting blazed with"
    ];

    // Initialize the channel data
    async function init() {
        await loadChannelTimes();
        initialized = true;
    }

    // Checks a message to see if it contains a banned phrase.
    this.checkForBannedPhrase = function (msg) {
        if (new RegExp("(\\b(" + bannedPhrases.join("|") + ")\\b)").test(msg.content.toLowerCase())) {
            applyWarning(msg);
        }
    }

    // Applies a warning to a user who has said a banned phrase.
    function applyWarning(msg) {
        var warningNumber = 0;

        if (!msg.member.roles.cache.some(r => r.name === "Warned 1")) {
            var warned1 = msg.guild.roles.cache.find(r => r.name === "Warned 1");
            msg.member.roles.add(warned1);
            warningNumber = 1;
        } else if (!msg.member.roles.cache.some(r => r.name === "Warned 2")) {
            var warned2 = msg.guild.roles.cache.find(r => r.name === "Warned 2");
            msg.member.roles.add(warned2);
            warningNumber = 2;
        } else {
            var warned3 = msg.guild.roles.cache.find(r => r.name === "Warned 3");
            msg.member.roles.add(warned3);
            warningNumber = 3;
        }

        logWarnedMessage(msg, warningNumber);

        if (warningNumber < 3) {
            msg.reply(`this is a cannabis only server. Please don't talk about other drugs. You have been warned ${warningNumber} times.`);
        } else {
            msg.reply(`this is a cannabis only server. Please don't talk about other drugs. FINAL WARNING!`);

            // Alert the moderation team that the user has been warned the maximum number of times.
            const channel = discordClient.channels.cache.find(channel => channel.name.toLowerCase() === "moderation");
            channel.send(`${msg.author} has hit 3 warnings for talking about drugs.`);
        }
    }

    // Log the message info of a banned phrase that resulted in a warning.
    function logWarnedMessage(msg, warningNumber) {
        MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("tokebot");

            var values = {
                user_id: msg.author.id,
                warning_number: warningNumber,
                message: msg.content,
                time: new Date().toLocaleString()
            };
            dbo.collection("warned_messages").insertOne(values, function (err, res) {
                if (err) throw err;
                db.close();
            });
        });
    }

    // Check to see if a message contains a command.
    this.checkForCmd = async function (msg) {

        // We need to make sure the channel is initalized before we proceed.
        if (!initialized) {
            await init();
        }

        // Remove the command prefix from the message
        msg.content = msg.content.slice(cmdPrefix.length);

        for (const [key, value] of Object.entries(commands)) {
            if (msg.content.toLowerCase().startsWith(key)) {
                value(msg, key);
                return;
            }
        }
    }

    // Ping command
    function ping(msg) {
        const timeTaken = Date.now() - msg.createdTimestamp;
        msg.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
    }

    // Toke command
    function toke(msg, command) {
        const args = msg.content.slice(command.length).trim().split(' ');

        // This command can be used two ways. If no number is entered as an argument, it is processed as a join / start.
        // If a number is entered it is processed as an update to the tokeInterval.
        if (isNaN(parseInt(args[0]))) {

            // If a session isn't running we need to start one, otherwise we can add the user to the current session.
            if (!sessionRunning) {
                if (canStartSession(msg)) {
                    startSession(msg, command);
                } else {
                    msg.reply("your rank isn't high enough to start a session. !pretoke to join the next session instead.")
                }
            }
            else {
                addParticipant(msg);
            }
        } else {
            setTokeInterval(msg, args[0]);
        }
    }

    // Whether or not the use has the appropriate rank to start a toke sesion.
    function canStartSession(msg) {
        return msg.member.roles.cache.some(r => r.name.toLowerCase().includes("mod")) ||
            msg.member.roles.cache.some(r => r.name.toLowerCase() === "veteran cc members") ||
            msg.member.roles.cache.some(r => r.name.toLowerCase() === "stoner") ||
            msg.member.roles.cache.some(r => r.name.toLowerCase() === "nitro booster");
    }

    // Starts a toke session for the channel.
    function startSession(msg, command) {
        const author = msg.author.toString();

        // We want a list of all the participants who aren't the author for use later.
        const filteredParticipants = participants.filter(function (p) {
            return p !== author;
        });

        if (participants.length > 0) {
            savePreTokeCount(participants.length);
        }

        // Add the user starting the session.
        addParticipant(msg);

        startSessionTimers();
        msg.channel.send(`${author} is starting a toke session` + (filteredParticipants.length > 0 ? ` with ` + filteredParticipants.join(", ") : "") +
            `. Type !toke to join. Ending in ${ Math.ceil(sessionInterval / 60000) } minutes.`);
        addSessionReact(msg);
    }

    // Set the amount of time a toke session lasts.
    function setTokeInterval(msg, minutes) {
        if (!canStartSession(msg)) return;

        if (!isNaN(minutes)) {
            var intMinutes = parseInt(minutes);

            // Range check the interval.
            if (intMinutes < 1) {
                intMinutes = 1;
            } else if (intMinutes > 60) {
                intMinutes = 60;
            }

            // Convert to minutes to ms.
            sessionInterval = intMinutes * 60000;
            saveChannelTimes();
            msg.channel.send(`Updated the session time to ${intMinutes} minutes.`);

            // Restart the session if it's running
            if (sessionRunning) {
                clearTimeout(tokeTimer);
                tokeTimer = setTimeout(function () {
                    tokeTimerElapsed();
                }, sessionInterval);
                timeStarted = Date.now();

                // Restart the reminder timer to keep it even with the session timer.
                clearInterval(reminderTimer);
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed();
                }, reminderInterval);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    // Set the amount of time between reminders.
    function setReminderInterval(msg, command) {
        if (!canStartSession(msg)) return;

        const args = msg.content.slice(command.length).trim().split(' ');
        var minutes = parseInt(args[0]);

        // Range check the interval
        if (minutes < 1) {
            minutes = 1;
        } else if (minutes > 60) {
            minutes = 60;
        }

        if (!isNaN(minutes)) {
            reminderInterval = minutes * 60000;
            saveChannelTimes();
            msg.channel.send(`Updated the reminder time to ${minutes} minutes.`);
            clearInterval(reminderTimer);

            // Restart the reminder timer if the session is running.
            if (sessionRunning) {
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed();
                }, reminderInterval);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    // Add a user to spirit tokers list. Spirit tokers are just like regular tokers, except with a different status
    // Used for when they want to join a session, but aren't toking
    function addSpiritToker(msg) {
        if (sessionRunning) {
            if (!spiritTokers.includes("<@" + msg.author.id + ">")) {
                spiritTokers.push("<@" + msg.author.id + ">");
            }

            // If they are joining the spirit session they don't need to be in participants anymore.
            if (participants.includes("<@" + msg.author.id + ">")) {
                participants.splice("<@" + msg.author.id + ">");
            }

            addSessionReact(msg);
        }
    }

    // Add a user to the list of participants in a toke session.
    function addParticipant(msg) {
        if (!participants.includes("<@" + msg.author.id + ">")) {
            participants.push("<@" + msg.author.id + ">");
        }

        // If they are joining the session they don't need to be in spirit tokers anymore.
        if (spiritTokers.includes("<@" + msg.author.id + ">")) {
            spiritTokers.splice("<@" + msg.author.id + ">");
        }

        addSessionReact(msg);
    }

    // Fired whenever tokeTimer elapses. The end of a toke sesion.
    function tokeTimerElapsed() {
        clearInterval(reminderTimer);
        clearTimeout(tokeTimer);
        const channel = discordClient.channels.cache.find(channel => channel.id === channelId);
        channel.send(`${sessionReplies1[Math.floor(Math.random() * sessionReplies1.length)]}` +
            ` ${sessionReplies2[Math.floor(Math.random() * sessionReplies2.length)]} ${participants.join(", ")}.` +
            (spiritTokers.length > 0 ? " Toking in spirit: " + spiritTokers.join(", ") + '.' : ""));
        saveTokeCount(participants.length, participants.slice());
        participants = [];
        spiritTokers = [];
        sessionRunning = false;
    }

    // Fired whenver reminderTimer elapses. Posts a reminder.
    function reminderTimerElapsed() {
        const channel = discordClient.channels.cache.find(channel => channel.id === channelId);

        // We only want to post the reminder if the last message was a reminder.
        if (sessionRunning && !(channel.lastMessage.author.tag === discordClient.user.tag)) {
            const channel = discordClient.channels.cache.find(channel => channel.id === channelId);
            channel.send(`Toke session in progress. Type !toke to join. Ending in ${Math.round((sessionInterval - (Date.now() - timeStarted)) / 60000)} minutes.`);
        }
    }

    // Adds a reaction to a message when a user starts or joins a session.
    function addSessionReact(msg) {

        // Use custom emotes for certain servers.
        if (msg.guild.name.toLowerCase() == "chronicchat") {
            msg.react(`656156154837205012`);
        } else {
            msg.react(`😁`);
        }
    }

    // Saves sessionInterval and reminderInterval to the database.
    function saveChannelTimes() {
        MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("tokebot");

            var keys = {
                channel_id: channelId
            };
            var values = {
                $setOnInsert: {
                    channel_id: channelId
                },
                $set: {
                    session: sessionInterval, reminder: reminderInterval
                }
            };
            dbo.collection("session_times").updateOne(keys, values, { upsert: true }, function (err, res) {
                if (err) throw err;
                db.close();
            });
        });
    }

    // Loads sessionInterval and reminderInterval from the database.
    async function loadChannelTimes() {
        const client = await MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true })
            .catch(err => { console.log(err); });

        if (!client) {
            return;
        }

        try {
            const db = client.db(`tokebot`);
            var dbo = db.collection('session_times');
            var keys = { channel_id: channelId }
            var res = await dbo.findOne(keys);
            sessionInterval = res.session;
            reminderInterval = res.reminder;
        } catch (err) {
            console.log(err);
        } finally {
            client.close();
        }
    }

    // Saves the pretokers to the database.
    function savePreTokeCount(count) {
        MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("tokebot");

            var values = {
                channel_id: channelId,
                count: count,
                participants: participants,
                time: new Date().toLocaleString()
            };
            dbo.collection("pretoke_counts").insertOne(values, function (err, res) {
                if (err) throw err;
                db.close();
            });
        });
    }

    // Save the toke session data to the database
    function saveTokeCount(count, participants) {
        MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("tokebot");

            var values = {
                channel_id: channelId,
                count: count,
                participants: participants,
                time: new Date().toLocaleString()
            };
            dbo.collection("toke_counts").insertOne(values, function (err, res) {
                if (err) throw err;
                db.close();
            });
        });
    }

    // Post the toke session records for the channel. (Number of toke sessions, most users in a session,
    // number sessions with pre tokes, most pretokes in a session)
    async function postRecords(msg, command) {
        const client = await MongoClient.connect(mongoConnectionUrl, { useUnifiedTopology: true },)
            .catch(err => { console.log(err); });

        if (!client) {
            return;
        }

        try {
            const db = client.db(`tokebot`);
            var tokeDbo = db.collection('toke_counts');
            var tokeKeys = { channel_id: channelId }
            var tokeSort = { count: -1 }
            var tokeRes = await tokeDbo.find(tokeKeys).sort(tokeSort).toArray();

            var preTokeDbo = db.collection('pretoke_counts');
            var preTokeKeys = { channel_id: channelId }
            var preTokeSort = { count: -1 }
            var preTokeRes = await preTokeDbo.find(preTokeKeys).sort(preTokeSort).toArray();

            const channel = discordClient.channels.cache.find(channel => channel.id == channelId);
            const embed = new discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Toke Records')
                .addFields(
                    { name: `Total toke sessions in #${msg.channel.name}`, value: tokeRes.length },
                    { name: `Total sessions with pre tokes in #${msg.channel.name}`, value: preTokeRes.length },
                    { name: 'Largest toke session', value: `${tokeRes.length > 0 ? tokeRes[0].count : 0} tokers.` },
                    { name: 'Largest pre toke session', value: `${preTokeRes.length > 0 ? preTokeRes[0].count : 0} pre tokers.` },
                );

            channel.send(embed);

        } catch (err) {
            console.log(err);
        } finally {
            client.close();
        }
    }

    // Check to see if it's 4:20 in a timezone.
    function checkTime() {

        // We only want to post in the main channels and not every channel that has had a toke session.
        if (channelName === "🗣smoke-circle" || channelName === "general") {
            var date = new Date();
            const channel = discordClient.channels.cache.find(channel => channel.id === channelId);
            var reply = null;

            if (date.getUTCMinutes() === 20) {
                reply = get420Reply();
            } else if (date.getUTCMinutes() === 10) {
                reply = get710Reply();
            }

            // Null reply means it's not 4:20
            if (reply !== null) {

                // Start a session if there are pre tokers and a session isn't active.
                if (participants.length > 0 && !sessionRunning) {
                    startSessionTimers();
                    reply = reply.concat(` Starting a session with ${participants.join(", ")}. Ending in ${Math.ceil(sessionInterval / 60000)} minutes.`);
                }

                channel.send(reply);
            }
        }
        else {
            // We don't need to check again because we're not in a main channel.
            clearInterval(timeCheckTimer);
        }
    }

    // Create a reply containing the current timezone in which it is 4:20
    function get420Reply() {
        var reply = "It's currently 4:20 ";
        var date = new Date();

        switch (date.getUTCHours()) {
            case 1:
            case 13:
                reply = reply.concat("in Finland.");
                break;
            case 2:
            case 14:
                reply = reply.concat("in Hawaii and South Africa.");
                break;
            case 3:
            case 15:
                reply = reply.concat("in London and Dublin.");
            case 4:
            case 16:
                reply = reply.concat("in Azores Islads.");
                break;
            case 5:
            case 17:
                reply = reply.concat("Somewhere in the Atlantic Ocean.");
                break;
            case 6:
            case 18:
                reply = reply.concat("in South Sandwich Islands and Australia.");
                break;
            case 7:
            case 19:
                reply = reply.concat("in Buenos Aires.");
                break;
            case 8:
            case 20:
                reply = reply.concat("in Puerto Rico and Eastern Time.");
                break;
            case 9:
            case 21:
                reply = reply.concat("in Central Time.");
                break;
            case 10:
            case 22:
                reply = reply.concat("in Mountain Time.");
                break;
            case 11:
            case 23:
                reply = reply.concat("Pacific Time.");
                break;
            case 12:
            case 0:
                reply =reply.concat("in Alaska Time.");
                break;
            default:
                // We don't need to reply because we don't follow other timezones.
                reply = null;
                break;
        }

        return reply;
    }

    // Starts toke session timers.
    function startSessionTimers() {
            sessionRunning = true;
            timeStarted = Date.now();

            tokeTimer = setTimeout(function () {
                tokeTimerElapsed();
            }, sessionInterval);

            reminderTimer = setInterval(function () {
                reminderTimerElapsed();
            }, reminderInterval);
    }

    // Create a reply containing the current timezone in which it is 7:10
    function get710Reply() {
        var reply = "It's currently 7:10 ";
        var date = new Date();

        switch (date.getUTCHours()) {
            case 13:
            case 1:
                reply = reply.concat("in Colorado.");
                break;
            default:
                // We don't need to reply because we don't follow other timezones.
                reply = null;
                break;
        }

        return reply;
    }

    // Posts the participants of a toke sesion.
    function postTokeParticipants() {
        const channel = discordClient.channels.cache.find(channel => channel.id === channelId);

        if (sessionRunning) {
            channel.send((participants.length > 0 ? "Current tokers: " + participants.join(", ") + '.' : "") +
                (spiritTokers.length > 0 ? " Toking in spirit: " + spiritTokers.join(", ") + '.' : ""), { "allowedMentions": { "users": [] } });
        } else {
            channel.send(participants.length > 0 ? ("Pretokers waiting to smoke: " + participants.join(", ") + ".") : "There is not currently a session running and there are no pre tokers.", { "allowedMentions": { "users": [] } });
        }
    }

    // Posts the current weather for a specified location.
    function postWeather(msg, command) {
        const location = msg.content.slice(command.length).trim();

        if (location === "") {
            msg.reply("Please enter a city to get the weather for.");
            return;
        }

        weather.find({ search: location, degreeType: 'F' }, function (err, result) {
            if (err) return;

            if (result.length > 0) {
                const degreesC = Math.round((parseInt(result[0].current.temperature) - 32) * 5 / 9);
                msg.reply(`The weather in ${result[0].location.name} is ${result[0].current.skytext}. It is currently ${result[0].current.temperature}°F / ${degreesC}°C.` +
                    ` Taken at ${timeConvert(result[0].current.observationtime)} on ${dateConvert(result[0].current.date)}.`);
            } else {
                msg.reply(`Could not find weather for ${location}`);
            }
        });
    }

    // Ends a toke session if one is currently running
    function endSession(msg, command) {
        if (!canStartSession(msg)) return;

        if (sessionRunning) {
            tokeTimerElapsed();
        }
        else {
            msg.reply("There is no active toke session.")
        }
    }

    // Converts time from 24 hour format to 12 hour format
    // https://stackoverflow.com/questions/13898423/javascript-convert-24-hour-time-of-day-string-to-12-hour-time-with-am-pm-and-no/13899011
    function timeConvert(time) {
        // Check correct time format and split into components
        time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

        if (time.length > 1) { // If time format correct
            time = time.slice(1);  // Remove full string match value
            time[5] = +time[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
            time[0] = +time[0] % 12 || 12; // Adjust hours
            time[3] = ""; // Remove seconds.
        }

        return time.join(''); // return adjusted time or original string
    }

    // Converts date string from year/month/day to month/day/year
    function dateConvert(dateString) {
        date = dateString.split("-");

        return date[1] + "/" + date[2] + "/" + date[0];
    }

    return this;
}
