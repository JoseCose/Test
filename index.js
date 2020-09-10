require('dotenv').config();
var http = require('http');
const discord = require("discord.js");
var MongoClient = require('mongodb').MongoClient;
var mongoConnectionUrl = process.env.mongo;
const cmdPrefix = "!";
var sessions = {};

const discordClient = new discord.Client();
discordClient.login(process.env.discord);
discordClient.on("message", function (msg) {
    if (msg.author.bot) return;
    const channelId = msg.channel.id;

    if (!(channelId in sessions)) {
        sessions[channelId] = new tokeSession(msg.channel.id, msg.channel.name.toLowerCase());
        createChannelData(msg);
    }
    sessions[channelId].checkForBannedPhrase(msg);

    if (!msg.content.startsWith(cmdPrefix)) return;

    sessions[channelId].checkForCmd(msg);
});

function createChannelData(msg) {
    MongoClient.connect(mongoConnectionUrl, function (err, db) {
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
    var tokeTimer;
    var reminderTimer;
    var sessionRunning = false;
    var sessionRunning = false;
    var participants = [];
    var spiritTokers = [];
    var sessionInterval = 300000;
    var reminderInterval = 120000;
    var initialized = false;

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
        "pre": addParticipant,
        "spirit": addSpiritToker,
        "dougdimmadab": toke
    };

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

    this.checkForBannedPhrase = function (msg) {
        if (new RegExp("\\b" + bannedPhrases.join("|") + "\\b").test(msg.content)) {
            applyWarning(msg);
        }
    }

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
            const channel = discordClient.channels.cache.find(channel => channel.name.toLowerCase() === "moderation");
            channel.send(`${msg.author} has hit 3 warnings for talking about drugs.`);
        }
    }

    function logWarnedMessage(msg, warningNumber) {
        MongoClient.connect(mongoConnectionUrl, function (err, db) {
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

    this.checkForCmd = async function (msg) {
        if (!initialized) {
            await init();
        }

        msg.content = msg.content.slice(cmdPrefix.length);

        for (const [key, value] of Object.entries(commands)) {
            if (msg.content.toLowerCase().startsWith(key)) {
                value(msg, key);
                return;
            }
        }
    }

    function ping(msg) {
        const timeTaken = Date.now() - msg.createdTimestamp;
        msg.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
    }

    function toke(msg, command) {
        const args = msg.content.slice(command.length).trim().split(' ');

        if (isNaN(parseInt(args[0]))) {
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

    function canStartSession(msg) {
        return msg.member.roles.cache.some(r => r.name === "Moderators") ||
            msg.member.roles.cache.some(r => r.name === "Veteran CC Members") ||
            msg.member.roles.cache.some(r => r.name === "Stoner");
    }

    function startSession(msg, command) {
        const author = msg.author.toString();
        const filteredParticipants = participants.filter(function (p) {
            return p !== author;
        });
        sessionRunning = true;

        if (participants.length > 0) {
            savePreTokeCount(participants.length);
        }

        addParticipant(msg);
        timeStarted = Date.now();

        tokeTimer = setTimeout(function () {
            tokeTimerElapsed(msg);
        }, sessionInterval);

        reminderTimer = setInterval(function () {
            reminderTimerElapsed(msg);
        }, reminderInterval);

        msg.channel.send(`${author} is starting a toke session` + (filteredParticipants.length > 0 ? ` with ` +
            filteredParticipants : "") + `. ` + (spiritTokers.length > 0 ? spiritTokers + ` toking in spirit. ` : ``) +
            `Type !toke to join. Ending in ${ Math.ceil(sessionInterval / 60000) } minutes.`);
        addSessionReact(msg);
        console.log(`Starting session.`);
    }

    function setTokeInterval(msg, minutes) {
        sessionInterval = minutes * 60000;
        saveChannelTimes();
        console.log(`Toke interval set to ${minutes} (${sessionInterval}ms).`);
        msg.channel.send(`Updated the session time to ${minutes} minutes.`);

        if (!isNaN(minutes)) {
            if (sessionRunning) {
                clearTimeout(tokeTimer);
                tokeTimer = setTimeout(function () {
                    tokeTimerElapsed(msg);
                }, sessionInterval);
                timeStarted = Date.now();
                console.log(`Restarted timer.`);

                // Restart the reminder timer to keep it even with the session timer. 
                clearInterval(reminderTimer);
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed(msg);
                }, reminderInterval);
                console.log(`Restarted reminder timer.`);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    function setReminderInterval(msg, command) {
        const args = msg.content.slice(command.length).trim().split(' ');
        const minutes = parseInt(args[0]);

        if (!isNaN(minutes)) {
            reminderInterval = minutes * 60000;
            saveChannelTimes();
            console.log(`Reminder interval set to ${minutes} minutes (${reminderInterval}ms).`);
            msg.channel.send(`Updated the reminder time to ${minutes} minutes.`);
            clearInterval(reminderTimer);

            if (sessionRunning) {
                reminderTimer = setInterval(function () {
                    reminderTimerElapsed(msg);
                }, reminderInterval);
                console.log(`Restarted reminder timer.`);
            }
        } else {
            msg.reply(`please enter a valid number for minutes.`);
        }
    }

    function addSpiritToker(msg) {
        // They don't need to toke in spirit if they are already in the session.
        if (!spiritTokers.includes(msg.author.toString()) && !participants.includes(msg.author.toString())) {
            spiritTokers.push(msg.author.toString());
        }

        addSessionReact(msg);
    }

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

    function tokeTimerElapsed(msg) {
        clearInterval(reminderTimer);
        clearTimeout(tokeTimer);
        console.log(`Session elapsed.`);
        msg.channel.send(`${sessionReplies1[Math.floor(Math.random() * sessionReplies1.length)]}` +
            ` ${sessionReplies2[Math.floor(Math.random() * sessionReplies2.length)]} ${participants}.` +
            (spiritTokers.length > 0 ? " Toking in spirit: " + spiritTokers : ""));
        saveTokeCount(participants.length, participants.slice());
        participants = [];
        spiritTokers = [];
        sessionRunning = false;
    }

    function reminderTimerElapsed(msg) {
        if (sessionRunning) {
            console.log(`Reminder elapsed.`);
            msg.channel.send(`Toke session in progress. Type !toke to join. Ending in ${Math.round((sessionInterval - (Date.now() - timeStarted)) / 60000)} minutes.`);
        }
    }

    function addSessionReact(msg) {
        if (msg.guild.name.toLowerCase() == "chronicchat") {
            msg.react(`656156154837205012`);
        } else {
            msg.react(`😁`);
        }
    }

    function saveChannelTimes() {
        MongoClient.connect(mongoConnectionUrl, function (err, db) {
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

    async function loadChannelTimes() {
        const client = await MongoClient.connect(mongoConnectionUrl, { useNewUrlParser: true })
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

    function savePreTokeCount(count) {
        MongoClient.connect(mongoConnectionUrl, function (err, db) {
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

    function saveTokeCount(count, participants) {
        MongoClient.connect(mongoConnectionUrl, function (err, db) {
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

    async function postRecords(msg, command) {
        const client = await MongoClient.connect(mongoConnectionUrl, { useNewUrlParser: true })
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

    var four20Timer = setInterval(check420, 60000);

    function check420() {
        var date = new Date();

        if (channelName === "main-chat" || channelName === "general") {
            if (date.getUTCMinutes() === 20) {
                const channel = discordClient.channels.cache.find(channel => channel.id === channelId);
                var reply = get420Reply();

                if (reply !== null) {
                    channel.send(get420Reply());
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

    function get420Reply() {
        var reply = "It's currently 4:20 ";
        var date = new Date();

        switch (date.getUTCHours()) {
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
            case 14:
            case 2:
                reply = reply.concat("in Hawaii Time.");
                break;
            default:
                // We don't need to reply because we don't follow other timezones.
                reply = null;
                break;

        }

        return reply;
    }

    return this;
}