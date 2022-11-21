const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('server')
		.setDescription('Replies with server info!'),
	async execute(client, interaction) {
        await interaction.reply({content: `Server info: ${interaction.guild.name} \n Total members: ${interaction.guild.memberCount} `, ephemeral : true});
	},
};