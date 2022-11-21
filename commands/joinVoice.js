
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const { SlashCommandBuilder } = require('discord.js')
const {EmbedBuilder }= require('discord.js')
const { FileWriter } = require('wav')
const { OpusEncoder, OpusDencoder} = require('@discordjs/opus');
const WebSocket = require('ws');
const { Transform } = require('stream');
const { assemblyToken } = require('../config.json')
require('dotenv').config();
const fetch = require('node-fetch');
const url ='https://api.assemblyai.com/v2/upload';
const fs = require('fs');
const axios = require("axios");
module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription('bot joins the voice channel of the user'),
	async execute(client, interaction) {
        if (interaction.member.voice.channel) {
            const voiceChannel = interaction.member.voice.channel;
            const connect = joinVoiceChannel({
                channelId : voiceChannel.id,
                guildId: interaction.channel.guild.id,
                selfDeaf: false,
                selfMute : true,
                adapterCreator : interaction.channel.guild.voiceAdapterCreator,
            });
            isSocketOpen = false;
            
            const connected = new EmbedBuilder()
            .setColor('Green')
            .setDescription('☎️ Connection was successful to websocket ☎️');
            await interaction.reply({embeds: [connected]});
            const encoder = new OpusEncoder(16000, 1);

            connect.receiver.speaking.on('start', async (user) => {
                if (user.bot) return;
                console.log(`user id is : ${user}`)
                console.log(` and the interaction id is: ${interaction.user.id}`)
                
                if ( user == interaction.user.id){
                    const texts = {};
                
                    isBossBotCalled = false;
                    
                    console.log(`Listening to <@${user}>`);
                    if (isSocketOpen == false){
                        console.log("socket is not open so opening a new one ");

                        socket = await new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&word_boost=%5B%22bot%22%5D`, 
                                {headers: {authorization: assemblyToken}}
                        );
                        isSocketOpen = true;
                    }  
                    socket.onerror = (event) => {
                        console.error(event);
                        socket.close();
                        console.log("socket error, closing socket for now.");
                        isSocketOpen = false;
                    }
                    socket.onopen = () => {
                        isSocketOpen = true;
                    }
                    socket.onmessage = (message) => {
                        console.log(message)
                        let msg = '';
                        const res = JSON.parse(message.data);
    
    
                        texts[res.audio_start] = res.text;
                        const keys = Object.keys(texts);
                        keys.sort((a, b) => a - b);
                        console.log(`keys are ${keys}`)
                        for (const key of keys) {
                            answer = `${texts[key]}`;
                            if (texts[key]!= undefined){
                                msg += `${texts[key]}`
                            }
    
                        }
                        realAnswer=msg.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
                            console.log("message without any punctuations or space is: ");
                            console.log(realAnswer)
                            words = realAnswer.split(" ");
                            words.forEach(function(val,i){
                                if (val == 'ver' &&  isBossBotCalled ==false){
                                    const connected = new EmbedBuilder()
                                        .setColor('Green')
                                        .setDescription('BOSS BOT IS LISTENING FOR NUMBERS');
                                        interaction.channel.send({embeds: [connected]});
                                        socket.close();
                                        isSocketOpen = false;
                                    isBossBotCalled = true;
    
                                }
                            })
                        console.log(msg);
                        msg ='';
    
                        if (res.error == "Session idle for too long. For more information contact support@assemblyai.com" ){
                            console.log("session idle for too long closing socket for now.");
                            isSocketOpen = false;
    
                            socket.close();
                        }
                        else if (res.error){
                            console.log("THERE IS AN UNKNOWN ERROR");
                            isSocketOpen = false;
    
                            socket.close();
                        }
                    };
                    const filename = `./recordings/myRecordings.pcm`;
                
                    const inputStream = new fs.createWriteStream(filename);
                    const opusStream = connect.receiver.subscribe(user, {
                        end: {
                            behavior: EndBehaviorType.AfterSilence,
                            duration: 400
                        },
                    })
                    .pipe(new OpusDecodingStream({}, encoder))
                    .pipe(inputStream)
                }
            })
            connect.receiver.speaking.on('end', async(user) => {
                if(user.bot) return;
                console.log( `FINISHED to ${user}`)
                if (socket){

                    var rawData =fs.readFileSync('./recordings/myRecordings.pcm', 'base64',()=>{});
                    console.log(`SENDING RAW DATA of ${rawData.length}`);
                    //if data is too big send it over as a file instead of a stream.
                    if (rawData.length >= 100000){
                        const assembly = axios.create({
                            baseURL: "https://api.assemblyai.com/v2",
                            headers: {
                                authorization: assemblyToken,
                                "content-type": "application/json",
                                "transfer-encoding": "chunked",
                            },
                        });
                        var url= "";
                        fs.readFile(filename, (err, data) => {
                            if (err) return console.error(err);
                            assembly
                                .post("/upload", data)
                                .then((res) => {
                                    console.log(res.data)
                                    url = res.data['upload_url']
                                    upload(url);
                                })

                                .catch((err) => console.error(err));
                        });
                        assembly
                            .post("/transcript", {
                                audio_url: "https://bit.ly/3yxKEIY"
                            })
                            .then((res) => console.log(res.data))
                            .catch((err) => console.error(err));

                    }

                    if( rawData.length >= 80000){
                        for (var i =0 ; i < rawData.length; i = i + 40000){
                            if (i + 40000 <= rawData.length){

                                var sliced = rawData.slice(i,i+40000)
                                socket.send(JSON.stringify({ audio_data: sliced}));

                            }
                            else if (rawData.length - i > 1000){
                                var sliced = rawData.slice(i, rawData.length)
                                socket.send(JSON.stringify({ audio_data: sliced}));
                            }

                        }

                    }
                    else{
                        console.log("short sending it now");
                        socket.send(JSON.stringify({audio_data:rawData}))
                    }

                }


            })
        }    
        else {
            return interaction.reply({ content : 'no one is in voice channel', ephemeral: true});
        }
	},
};

class OpusDecodingStream extends Transform {
    encoder
    constructor(options, encoder) {
        super(options)
        this.encoder = encoder
    }

    _transform(data, encoding, callback) {
        this.push(this.encoder.decode(data))
        callback()
    }
}
async function upload(myUrl){
    const assembly = axios.create({ baseURL: "https://api.assemblyai.com/v2",
        headers: {
            authorization: assemblyToken
            ,
            "content-type": "application/json",
        },
    });
    assembly
        .post("/transcript", {
            audio_url: myUrl
        })
        .then((res) => console.log(res.data))
        .catch((err) => console.error(err));
    }
