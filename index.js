// DotEnv (environment variables).
require('dotenv').config();

// Node.js
var http = require('http');

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
        channels[channelId] = new tokeSession(msg.channel.id, msg.channel.name.toLowerCase());
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
            console.log(`Inserted channels data. Matched: ${res.matchedCount} Modified: ${res.modifiedCount} Upserted: ${res.upsertedCount}`);
            db.close();
        });
    });
}

function tokeSession(channelId, channelName) {
    // Timer for toke sessions
    var tokeTimer;

    // Timer for reminders
    var reminderTimer;

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
        // pretoke is a way of joining a session in advance. 
        // Users are added straight to list of participants
        "pre": addParticipant, 
        
        "spirit": addSpiritToker,
        "dougdimmadab": toke
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
        "Man that was a good session."];

    // The second part of a two part reply when a session ends.
    // {sessionReplies1}. {sessionReplies2}.
    var sessionReplies2 = [
        "Getting stoned with",
        "Toking it up with",
        "Smoking with",
        "Stoned with the homies",
        "That was a nice session with",
        "Blazing with",
        "Burning one with"
    ];

    // Initialize the channel data
    async function init() {
        await loadChannelTimes();
        initialized = true;
    }

    // Checks a message to see if it contains a banned phrase.
    this.checkForBannedPhrase = function (msg) {
        if (new RegExp("\\b" + bannedPhrases.join("|") + "\\b").test(msg.content)) {
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
                console.log(`Inserted warned_messages data.`);
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
        return msg.member.roles.cache.some(r => r.name === "Moderators") ||
            msg.member.roles.cache.some(r => r.name === "Veteran CC Members") ||
            msg.member.roles.cache.some(r => r.name === "Stoner");
    }

    // Starts a toke session for the channel.
    function startSession(msg, command) {
        const author = msg.author.toString();

        // We want a list of all the participants who aren't the author for use later.
        const filteredParticipants = participants.filter(function (p) {
            return p !== author;
        });
        sessionRunning = true;

        if (participants.length > 0) {
            savePreTokeCount(participants.length);
        }

        // Add the user starting the session.
        addParticipant(msg);
        timeStarted = Date.now();

        tokeTimer = setTimeout(function () {
            tokeTimerElapsed();
        }, sessionInterval);

        reminderTimer = setInterval(function () {
            reminderTimerElapsed();
        }, reminderInterval);

        msg.channel.send(`${author} is starting a toke session` + (filteredParticipants.length > 0 ? ` with ` + filteredParticipants.join(", ") : "") +
            `. Type !toke to join. Ending in ${ Math.ceil(sessionInterval / 60000) } minutes.`);
        addSessionReact(msg);
        console.log(`Starting session.`);
    }

    // Set the amount of time a toke session lasts.
    function setTokeInterval(msg, minutes) {
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
            console.log(`Toke interval set to ${intMinutes} (${sessionInterval}ms).`);
            msg.channel.send(`Updated the session time to ${intMinutes} minutes.`);

            // Restart the session if it's running
            if (sessionRunning) {
                clearTimeout(tokeTimer);
                tokeTimer = setTimeout(function () {
                    tokeTimerElapsed();
                }, sessionInterval);
                timeStarted = Date.now();
                console.log(`Restarted timer.`);

                // Restart the reminder timer to keep it even with the session timer. 
                clearInterval(reminderTimer);
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed();
                }, reminderInterval);
                console.log(`Restarted reminder timer.`);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    // Set the amount of time between reminders.
    function setReminderInterval(msg, command) {
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
            console.log(`Reminder interval set to ${minutes} minutes (${reminderInterval}ms).`);
            msg.channel.send(`Updated the reminder time to ${minutes} minutes.`);
            clearInterval(reminderTimer);

            // Restart the reminder timer if the session is running.
            if (sessionRunning) {
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed();
                }, reminderInterval);
                console.log(`Restarted reminder timer.`);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    // Add a user to spirit tokers list. Spirit tokers are just like regular tokers, except with a different status
    // Used for when they want to join a session, but aren't toking
    function addSpiritToker(msg) {
        if (sessionRunning) {
            if (!spiritTokers.includes(msg.author.toString())) {
                spiritTokers.push(msg.author.toString());
            }

            // If they are joining the spirit session they don't need to be in participants anymore.
            if (participants.includes(msg.author.toString())) {
                participants.splice(msg.author.toString());
            }

            addSessionReact(msg);
        }
    }

    // Add a user to the list of participants in a toke session.
    function addParticipant(msg) {
        if (!participants.includes(msg.author.toString())) {
            participants.push(msg.author.toString());
        }

        // If they are joining the session they don't need to be in spirit tokers anymore.
        if (spiritTokers.includes(msg.author.toString())) {
            spiritTokers.splice(msg.author.toString());
        }

        addSessionReact(msg);
    }

    // Fired whenever tokeTimer elapses. The end of a toke sesion.
    function tokeTimerElapsed() {
        clearInterval(reminderTimer);
        clearTimeout(tokeTimer);
        console.log(`Session elapsed.`);
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
        if (sessionRunning) {
            console.log(`Reminder elapsed.`);
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
                console.log(`Inserted session_times data. Matched: ${res.matchedCount} Modified: ${res.modifiedCount} Upserted: ${res.upsertedCount}`);
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
                console.log(`Inserted pretoke_counts data.`);
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
                console.log(`Inserted toke_counts data.`);
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
            channel.send(`There have been ${tokeRes.length} toke sessions in ${msg.channel}. ${preTokeRes.length} had pre tokes. \n` +
                `Largest toke session: ${tokeRes.length > 0 ? tokeRes[0].count : 0} tokers. \n` +
                `Largest pre toke session: ${preTokeRes.length > 0 ? preTokeRes[0].count : 0} pre tokers.`);
            
        } catch (err) {
            console.log(err);
        } finally {
            client.close();
        }
    }

    // Timer to continually check to see if it's 4:20 somwhere.
    var four20Timer = setInterval(check420, 60000);

    // Check to see if it's 4:20 in a timezone.
    function check420() {
        var date = new Date();

        // We only want to post in the main channels and not every channel that has had a toke session.
        if (channelName === "main-chat" || channelName === "general") {
            if (date.getUTCMinutes() === 20) {
                const channel = discordClient.channels.cache.find(channel => channel.id === channelId);
                var reply = get420Reply();

                // Null reply means it's not 4:20
                if (reply !== null) {

                    // Start a session if there are pre tokers and a session isn't active.
                    if (participants.length > 0 && !sessionRunning) {
                        start420Session();
                        reply = reply.concat(` Starting a sesion with ${participants.join(", ")}. Ending in ${Math.ceil(sessionInterval / 60000)} minutes.`);
                    }

                    channel.send(reply);
                }

                // Call again in one hour.
                clearInterval(four20Timer);
                four20Timer = setInterval(check420, 3600000);
            }
        }
        else {
            // We don't need to check again because we're not in a main channel.
            clearInterval(four20Timer);
        }
    }

    // Create a reply containing the current timezone in which it is 4:20
    function get420Reply() {
        var reply = "It's currently 4:20 ";
        var date = new Date();

        switch (date.getUTCHours()) {
            case 0:
            case 12:
                reply = reply.concat("in Alaska Time.");
                break;
            case 2:
            case 14:
                reply = reply.concat("in Hawaii Time and South Africa Standard Time.");
                break;
            case 3:
            case 15:
                reply = reply.concat("in British Summer Time.");
                break;
            case 8:
            case 20:
                reply = reply.concat("in Eastern Time.");
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
                reply =reply.concat("in Pacific Time.");
                break;
            default:
                // We don't need to reply because we don't follow other timezones.
                reply = null;
                break;
        }

        return reply;
    }

    // Starts a toke session specifically for 4:20
    function start420Session() {
        sessionRunning = true;
        timeStarted = Date.now();

        tokeTimer = setTimeout(function () {
            tokeTimerElapsed();
        }, sessionInterval);

        reminderTimer = setInterval(function () {
            reminderTimerElapsed();
        }, reminderInterval);

        console.log(`Starting 420 session.`);
    }

    return this;
}