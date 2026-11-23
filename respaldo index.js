const path = require('path');
const readline = require('readline');
const express = require('express');
const cookieParser = require('cookie-parser');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  ActivityType
} = require('discord.js');

// ==========================================
// CONFIGURACIÓN PRINCIPAL (COMPLETA TUS DATOS)
// ==========================================
const TOKEN = 'mhabdubdbwubdbf';
const CLIENT_ID = '82828279119';
const CLIENT_SECRET = 'bjb4hbj37cbb8d3';
const OWNER_ID = '72726182693862693623';
const PORT = process.env.PORT || 3000;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/discord/callback`;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const sessions = new Map();
const guildConfigs = new Map();

function getGuildConfig(guildId) {
  if (!guildConfigs.has(guildId)) {
    guildConfigs.set(guildId, {
      antiraid: false,
      antibots: false,
      verification: false,
      logsChannelId: '',
      welcomeChannelId: '',
      welcomeMessage: 'Bienvenido {user} a {server}. Pasala genial en la comunidad.',
      autoroleId: '',
      whitelistUsers: [],
      whitelistChannels: [],
      auditLogs: []
    });
  }
  return guildConfigs.get(guildId);
}

function addAuditLog(guildId, userTag, action) {
  const cfg = getGuildConfig(guildId);
  cfg.auditLogs.unshift({
    user: userTag,
    action,
    time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  });
  if (cfg.auditLogs.length > 20) cfg.auditLogs.pop();
}

// ==========================================
// CONSOLA INTERACTIVA EN TERMINAL (INDEX.JS)
// ==========================================
function startTerminalConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const printConsoleHelp = () => {
    console.log('\n--- CONSOLA TAMAYOBOT SYSTEM ---');
    console.log('servers / servidores          -> Lista ID, nombre y miembros de cada servidor');
    console.log('leave <guildId> / expulsar <id> -> Saca al bot del servidor indicado');
    console.log('invite <guildId> / invitar <id> -> Crea un enlace de invitacion en un canal del servidor');
    console.log('say <channelId> <texto>       -> Envia un mensaje directo a un canal');
    console.log('status <texto>                -> Cambia el estado visible del bot');
    console.log('stats                         -> Muestra ping, servidores y memoria');
    console.log('help / ayuda                  -> Muestra esta lista');
    console.log('--------------------------------\n');
  };

  rl.on('line', async (rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const [cmdRaw, ...args] = line.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();

    if (cmd === 'help' || cmd === 'ayuda') {
      return printConsoleHelp();
    }

    if (cmd === 'servers' || cmd === 'servidores') {
      console.log(`\nServidores conectados (${client.guilds.cache.size}):`);
      client.guilds.cache.forEach((g) => {
        console.log(`- [${g.id}] ${g.name} (${g.memberCount} miembros)`);
      });
      console.log('');
      return;
    }

    if (cmd === 'leave' || cmd === 'expulsar') {
      const targetId = args[0];
      if (!targetId) {
        return console.log('Uso correcto: leave <ID_DEL_SERVIDOR>');
      }
      const targetGuild = client.guilds.cache.get(targetId);
      if (!targetGuild) {
        return console.log(`No se encontro ningun servidor con ID ${targetId}.`);
      }
      const guildName = targetGuild.name;
      await targetGuild.leave().catch((err) => {
        console.log('Error al salir del servidor:', err.message);
      });
      console.log(`Bot expulsado/retirado de "${guildName}" (${targetId}).`);
      return;
    }

    if (cmd === 'invite' || cmd === 'invitar') {
      const targetId = args[0];
      if (!targetId) {
        return console.log('Uso correcto: invite <ID_DEL_SERVIDOR>');
      }
      const targetGuild = client.guilds.cache.get(targetId);
      if (!targetGuild) {
        return console.log(`No se encontro el servidor ${targetId}.`);
      }
      const textChannel = targetGuild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.permissionsFor(targetGuild.members.me)?.has(PermissionsBitField.Flags.CreateInstantInvite)
      );
      if (!textChannel) {
        return console.log('No hay ningun canal donde el bot tenga permiso para crear invitaciones.');
      }
      const inv = await textChannel.createInvite({ maxAge: 86400, maxUses: 1 }).catch(() => null);
      console.log(inv ? `Invitacion (24h, 1 uso): ${inv.url}` : 'No se pudo generar la invitacion.');
      return;
    }

    if (cmd === 'say') {
      const channelId = args[0];
      const msg = args.slice(1).join(' ');
      if (!channelId || !msg) {
        return console.log('Uso correcto: say <ID_DEL_CANAL> <mensaje>');
      }
      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (!ch || !ch.isTextBased()) {
        return console.log('Canal no encontrado o no es de texto.');
      }
      await ch.send(msg).catch((err) => console.log('Error al enviar mensaje:', err.message));
      console.log(`Mensaje enviado a #${ch.name || channelId}.`);
      return;
    }

    if (cmd === 'status') {
      const text = args.join(' ');
      if (!text) {
        return console.log('Uso correcto: status <texto del estado>');
      }
      client.user.setPresence({
        activities: [{ name: text, type: ActivityType.Playing }],
        status: 'online'
      });
      console.log(`Estado actualizado a: "${text}"`);
      return;
    }

    if (cmd === 'stats') {
      const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      console.log(
        `Estado: ${client.user?.tag} | Ping: ${Math.round(client.ws.ping)}ms | Servidores: ${client.guilds.cache.size} | RAM: ${memMb} MB`
      );
      return;
    }

    console.log(`Comando de consola desconocido: "${cmd}". Escribe "help" para ver los disponibles.`);
  });
}

// ==========================================
// DEFINICIÓN DE LOS SLASH COMMANDS (/)
// ==========================================
const commands = [
  new SlashCommandBuilder().setName('ayuda').setDescription('Muestra la lista principal de comandos de TamayoBOT System.'),
  new SlashCommandBuilder().setName('help').setDescription('Muestra todos los comandos de moderacion y seguridad disponibles.'),
  new SlashCommandBuilder().setName('hola').setDescription('Recibe un saludo de parte del bot.'),
  new SlashCommandBuilder().setName('ping').setDescription('Mide la latencia actual del bot.'),
  new SlashCommandBuilder().setName('servicios').setDescription('Muestra el portafolio oficial de TamayoBOT System.'),
  new SlashCommandBuilder().setName('info').setDescription('Muestra informacion y estadisticas del servidor.'),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Muestra tu avatar o el de otro usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario objetivo').setRequired(false)),
  new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Publica un anuncio oficial (solo moderadores/admins).')
    .addStringOption(o => o.setName('mensaje').setDescription('Texto del anuncio').setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Elimina cierta cantidad de mensajes (1 a 100).')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Mensajes a eliminar').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un usuario del servidor.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Motivo').setRequired(false)),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un usuario del servidor.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a banear').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Motivo').setRequired(false)),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Desbanea a un usuario usando su ID.')
    .addStringOption(o => o.setName('user_id').setDescription('ID del usuario').setRequired(true)),
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutea temporalmente a un usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a mutear').setRequired(true))
    .addIntegerOption(o => o.setName('minutos').setDescription('Minutos').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Motivo').setRequired(false)),
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Quita el mute a un usuario del servidor.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a desmutear').setRequired(true)),
  new SlashCommandBuilder().setName('check').setDescription('Comprueba la configuracion de TamayoBOT System.'),
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configura el canal de logs del servidor.')
    .addChannelOption(o => o.setName('canal').setDescription('Canal de logs').setRequired(true)),
  new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Activa o desactiva el sistema antiraid.')
    .addBooleanOption(o => o.setName('estado').setDescription('Estado').setRequired(true)),
  new SlashCommandBuilder()
    .setName('antibots')
    .setDescription('Activa o desactiva el sistema Anti Bots.')
    .addBooleanOption(o => o.setName('estado').setDescription('Estado').setRequired(true)),
  new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Configura el estado de verificacion del servidor.')
    .addBooleanOption(o => o.setName('estado').setDescription('Estado').setRequired(true)),
  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Gestiona la whitelist de usuarios.')
    .addStringOption(o => o.setName('accion').setDescription('Accion').addChoices({ name: 'agregar', value: 'add' }, { name: 'quitar', value: 'remove' }).setRequired(true))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)),
  new SlashCommandBuilder()
    .setName('canal_whitelist')
    .setDescription('Gestiona los canales en whitelist.')
    .addStringOption(o => o.setName('accion').setDescription('Accion').addChoices({ name: 'agregar', value: 'add' }, { name: 'quitar', value: 'remove' }).setRequired(true))
    .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true)),
  new SlashCommandBuilder().setName('mostrar_configuracion').setDescription('Muestra la configuracion actual de seguridad.'),
  new SlashCommandBuilder().setName('settings').setDescription('Muestra los ajustes adicionales de seguridad.'),
  new SlashCommandBuilder().setName('checkusers').setDescription('Analiza cuentas recientes y bots en el servidor.'),
  new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Comprueba tu perfil o el de otro usuario.')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(false)),
  new SlashCommandBuilder()
    .setName('salir_servidor')
    .setDescription('Saca al bot de un servidor especifico por su ID (solo dueno).')
    .addStringOption(o => o.setName('guild_id').setDescription('ID del servidor').setRequired(true))
].map(c => c.toJSON());

// ==========================================
// EVENTOS DEL BOT DE DISCORD
// ==========================================
client.once('clientReady', async () => {
  console.log('Bot conectado como:', client.user.tag);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands (/) sincronizados.');
  } catch (err) {
    console.error('Error registrando comandos:', err);
  }
  startTerminalConsole();
  console.log('Consola activa. Escribe "servers" o "help" aqui abajo.');
});

client.on('guildMemberAdd', async (member) => {
  const cfg = getGuildConfig(member.guild.id);

  if (cfg.antibots && member.user.bot) {
    await member.kick('Sistema Anti-Bots activo en TamayoBOT System').catch(() => {});
    return;
  }

  if (cfg.autoroleId) {
    await member.roles.add(cfg.autoroleId).catch(() => {});
  }

  if (cfg.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (channel && channel.isTextBased()) {
      const text = cfg.welcomeMessage
        .replace('{user}', `<@${member.id}>`)
        .replace('{server}', member.guild.name);
      channel.send({ content: text }).catch(() => {});
    }
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.id !== client.user.id) return;

  const cfg = getGuildConfig(newMember.guild.id);
  const botRole = newMember.guild.members.me?.roles.botRole;

  if (botRole && !newMember.roles.cache.has(botRole.id) && botRole.editable) {
    await newMember.roles.add(botRole, 'Proteccion de rol de TamayoBOT System').catch(() => {});
  }

  if (cfg.autoroleId && !newMember.roles.cache.has(cfg.autoroleId)) {
    await newMember.roles.add(cfg.autoroleId, 'Restaurando rol configurado').catch(() => {});
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild } = interaction;
  const config = guild ? getGuildConfig(guild.id) : null;

  if (commandName === 'salir_servidor') {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: 'Este comando es exclusivo del dueno del bot.', ephemeral: true });
    }
    const targetGuildId = interaction.options.getString('guild_id').trim();
    const targetGuild = client.guilds.cache.get(targetGuildId);
    if (!targetGuild) {
      return interaction.reply({ content: 'El bot no esta en ningun servidor con esa ID.', ephemeral: true });
    }
    const guildName = targetGuild.name;
    await targetGuild.leave();
    return interaction.reply({ content: `El bot salio del servidor **${guildName}** (\`${targetGuildId}\`).`, ephemeral: true });
  }

  if (commandName === 'ayuda') {
    const embed = new EmbedBuilder()
      .setColor('#2563eb')
      .setTitle('Panel Principal — TamayoBOT System')
      .setDescription('Comandos disponibles con `/` y gestion desde el Dashboard Web.')
      .addFields(
        { name: 'General', value: '`/hola` `/ping` `/servicios` `/info` `/avatar` `/perfil`', inline: false },
        { name: 'Moderacion', value: '`/clear` `/kick` `/ban` `/unban` `/mute` `/unmute` `/anuncio`', inline: false },
        { name: 'Seguridad', value: '`/antiraid` `/antibots` `/verification` `/whitelist` `/logs` `/check`', inline: false }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#0284c7')
      .setTitle('Moderacion y Seguridad — TamayoBOT System')
      .addFields(
        { name: 'Moderacion', value: '`/clear` `/kick` `/ban` `/unban` `/mute` `/unmute`', inline: false },
        { name: 'Seguridad', value: '`/antiraid` `/antibots` `/verification` `/whitelist` `/canal_whitelist` `/checkusers`', inline: false },
        { name: 'Ajustes', value: '`/check` `/logs` `/mostrar_configuracion` `/settings` `/perfil`', inline: false }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'hola') return interaction.reply(`Hola, **${interaction.user.username}**. Bienvenido a **TamayoBOT System**.`);
  if (commandName === 'ping') {
    const ping = Math.max(1, Math.abs(Date.now() - interaction.createdTimestamp));
    return interaction.reply(`Pong. Latencia actual: **${ping}ms** | API: **${Math.round(client.ws.ping)}ms**.`);
  }

  if (commandName === 'servicios') {
    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('Servicios Oficiales — TamayoBOT System')
      .addFields(
        { name: '1. Desarrollo Web', value: 'Paginas web y dashboards personalizados.' },
        { name: '2. Configuracion de Discord', value: 'Canales, roles, permisos y automatizacion.' },
        { name: '3. Bots a Medida', value: 'Sistemas exclusivos para tu comunidad.' }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'info') {
    const embed = new EmbedBuilder()
      .setColor('#2563eb')
      .setTitle(`Informacion de ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Miembros', value: `${guild.memberCount}`, inline: true },
        { name: 'Canales', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'avatar') {
    const u = interaction.options.getUser('usuario') || interaction.user;
    const embed = new EmbedBuilder().setColor('#3b82f6').setTitle(`Avatar de ${u.username}`).setImage(u.displayAvatarURL({ dynamic: true, size: 512 }));
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'anuncio') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'No tienes permisos para publicar anuncios.', ephemeral: true });
    }
    const msg = interaction.options.getString('mensaje');
    const embed = new EmbedBuilder()
      .setColor('#2563eb')
      .setTitle('ANUNCIO OFICIAL')
      .setDescription(msg)
      .setFooter({ text: `Publicado por ${interaction.user.username} • TamayoBOT System` })
      .setTimestamp();
    await interaction.reply({ content: 'Anuncio publicado.', ephemeral: true });
    return interaction.channel.send({ embeds: [embed] });
  }

  if (commandName === 'clear') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const cant = interaction.options.getInteger('cantidad');
    const del = await interaction.channel.bulkDelete(cant, true);
    return interaction.reply({ content: `**${del.size}** mensajes eliminados.`, ephemeral: true });
  }

  if (commandName === 'kick') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const u = interaction.options.getUser('usuario');
    const r = interaction.options.getString('razon') || 'Sin motivo';
    const m = await guild.members.fetch(u.id).catch(() => null);
    if (!m || !m.kickable) return interaction.reply({ content: 'No se puede expulsar a este usuario.', ephemeral: true });
    await m.kick(r);
    return interaction.reply(`**${u.tag}** expulsado. Motivo: *${r}*`);
  }

  if (commandName === 'ban') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const u = interaction.options.getUser('usuario');
    const r = interaction.options.getString('razon') || 'Sin motivo';
    await guild.members.ban(u.id, { reason: r });
    return interaction.reply(`**${u.tag}** baneado. Motivo: *${r}*`);
  }

  if (commandName === 'unban') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const id = interaction.options.getString('user_id').trim();
    try {
      await guild.members.unban(id);
      return interaction.reply(`ID \`${id}\` desbaneada.`);
    } catch {
      return interaction.reply({ content: 'No se pudo desbanear esa ID.', ephemeral: true });
    }
  }

  if (commandName === 'mute') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const u = interaction.options.getUser('usuario');
    const min = interaction.options.getInteger('minutos');
    const r = interaction.options.getString('razon') || 'Sin motivo';
    const m = await guild.members.fetch(u.id).catch(() => null);
    if (!m || !m.moderatable) return interaction.reply({ content: 'No se puede mutear.', ephemeral: true });
    await m.timeout(min * 60 * 1000, r);
    return interaction.reply(`**${u.tag}** muteado por **${min} min**.`);
  }

  if (commandName === 'unmute') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const u = interaction.options.getUser('usuario');
    const m = await guild.members.fetch(u.id).catch(() => null);
    if (!m) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });
    await m.timeout(null);
    return interaction.reply(`Mute retirado a **${u.tag}**.`);
  }

  if (commandName === 'check') {
    return interaction.reply('**TamayoBOT System** esta activo, sincronizado con el Dashboard Web y listo.');
  }

  if (commandName === 'logs') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    const c = interaction.options.getChannel('canal');
    config.logsChannelId = c.id;
    return interaction.reply(`Canal de logs configurado en <#${c.id}>.`);
  }

  if (commandName === 'antiraid') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    config.antiraid = interaction.options.getBoolean('estado');
    return interaction.reply(`Antiraid: **${config.antiraid ? 'ACTIVADO' : 'DESACTIVADO'}**`);
  }

  if (commandName === 'antibots') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    config.antibots = interaction.options.getBoolean('estado');
    return interaction.reply(`Anti Bots: **${config.antibots ? 'ACTIVADO' : 'DESACTIVADO'}**`);
  }

  if (commandName === 'verification') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: 'Sin permisos.', ephemeral: true });
    config.verification = interaction.options.getBoolean('estado');
    return interaction.reply(`Verificacion: **${config.verification ? 'ACTIVADA' : 'DESACTIVADA'}**`);
  }

  if (commandName === 'whitelist') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Solo admins.', ephemeral: true });
    const act = interaction.options.getString('accion');
    const u = interaction.options.getUser('usuario');
    if (act === 'add') {
      if (!config.whitelistUsers.includes(u.id)) config.whitelistUsers.push(u.id);
      return interaction.reply(`**${u.tag}** anadido a la whitelist.`);
    }
    config.whitelistUsers = config.whitelistUsers.filter(id => id !== u.id);
    return interaction.reply(`**${u.tag}** quitado de la whitelist.`);
  }

  if (commandName === 'canal_whitelist') {
    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Solo admins.', ephemeral: true });
    const act = interaction.options.getString('accion');
    const c = interaction.options.getChannel('canal');
    if (act === 'add') {
      if (!config.whitelistChannels.includes(c.id)) config.whitelistChannels.push(c.id);
      return interaction.reply(`<#${c.id}> anadido a whitelist.`);
    }
    config.whitelistChannels = config.whitelistChannels.filter(id => id !== c.id);
    return interaction.reply(`<#${c.id}> quitado de whitelist.`);
  }

  if (commandName === 'mostrar_configuracion' || commandName === 'settings') {
    const embed = new EmbedBuilder()
      .setColor('#2563eb')
      .setTitle(`Configuracion — ${guild.name}`)
      .addFields(
        { name: 'Antiraid', value: config.antiraid ? 'Activo' : 'Inactivo', inline: true },
        { name: 'Anti Bots', value: config.antibots ? 'Activo' : 'Inactivo', inline: true },
        { name: 'Verificacion', value: config.verification ? 'Activa' : 'Inactiva', inline: true },
        { name: 'Logs', value: config.logsChannelId ? `<#${config.logsChannelId}>` : 'Sin definir', inline: true },
        { name: 'Bienvenidas', value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : 'Sin definir', inline: true }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'checkusers') {
    const members = await guild.members.fetch();
    const bots = members.filter(m => m.user.bot).size;
    return interaction.reply(`Miembros totales: **${members.size}** | Bots detectados: **${bots}**`);
  }

  if (commandName === 'perfil') {
    const u = interaction.options.getUser('usuario') || interaction.user;
    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle(`Perfil de ${u.username}`)
      .setThumbnail(u.displayAvatarURL({ dynamic: true }))
      .addFields({ name: 'ID', value: `\`${u.id}\``, inline: true });
    return interaction.reply({ embeds: [embed] });
  }
});

// ==========================================
// RUTAS DE AUTENTICACIÓN DISCORD OAUTH2
// ==========================================
app.get('/auth/discord', (req, res) => {
  const scope = encodeURIComponent('identify guilds');
  const redirect = encodeURIComponent(REDIRECT_URI);
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=${scope}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/?error=oauth');

    const [userRes, guildsRes] = await Promise.all([
      fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }),
      fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      })
    ]);

    const user = await userRes.json();
    const guilds = await guildsRes.json();

    const adminGuilds = Array.isArray(guilds)
      ? guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n || (BigInt(g.permissions) & 0x20n) === 0x20n)
      : [];

    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(sessionId, { user, guilds: adminGuilds });

    res.cookie('tamayo_session', sessionId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (err) {
    console.error('Error OAuth2:', err);
    res.redirect('/?error=server');
  }
});

app.get('/auth/logout', (req, res) => {
  const sid = req.cookies.tamayo_session;
  if (sid) sessions.delete(sid);
  res.clearCookie('tamayo_session');
  res.redirect('/');
});

// ==========================================
// API CONECTADA A PUBLIC/INDEX.HTML
// ==========================================
function getSessionUser(req) {
  const sid = req.cookies.tamayo_session;
  return sid ? sessions.get(sid) : null;
}

app.get('/api/me', (req, res) => {
  const session = getSessionUser(req);
  const botAvatar = client.user ? client.user.displayAvatarURL({ size: 256 }) : '';
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

  if (!session) {
    return res.json({
      loggedIn: false,
      botName: client.user ? client.user.username : 'TamayoBOT System',
      botAvatar,
      inviteUrl
    });
  }

  const enrichedGuilds = session.guilds.map(g => {
    const botGuild = client.guilds.cache.get(g.id);
    return {
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      botInGuild: Boolean(botGuild),
      memberCount: botGuild ? botGuild.memberCount : null
    };
  });

  res.json({
    loggedIn: true,
    botName: client.user ? client.user.username : 'TamayoBOT System',
    botAvatar,
    inviteUrl,
    user: {
      id: session.user.id,
      username: session.user.global_name || session.user.username,
      avatar: session.user.avatar
        ? `https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.png?size=128`
        : 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    guilds: enrichedGuilds
  });
});

app.get('/api/guild/:guildId', (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'No autenticado' });

  const { guildId } = req.params;
  const hasAccess = session.guilds.some(g => g.id === guildId);
  if (!hasAccess) return res.status(403).json({ error: 'Sin acceso' });

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'El bot no esta en este servidor' });

  const textChannels = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .map(c => ({ id: c.id, name: c.name }));

  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .map(r => ({ id: r.id, name: r.name }));

  res.json({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ dynamic: true, size: 256 }),
    memberCount: guild.memberCount,
    channelCount: guild.channels.cache.size,
    roleCount: guild.roles.cache.size,
    textChannels,
    roles,
    config: getGuildConfig(guild.id)
  });
});

app.post('/api/guild/:guildId/settings', (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'No autenticado' });

  const { guildId } = req.params;
  const cfg = getGuildConfig(guildId);
  const fields = ['antiraid', 'antibots', 'verification', 'logsChannelId', 'welcomeChannelId', 'welcomeMessage', 'autoroleId'];

  for (const f of fields) {
    if (req.body[f] !== undefined) cfg[f] = req.body[f];
  }

  addAuditLog(guildId, session.user.username, 'Actualizo ajustes desde el Dashboard Web');
  res.json({ ok: true, config: cfg });
});

app.post('/api/guild/:guildId/announce', async (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'No autenticado' });

  const { guildId } = req.params;
  const { channelId, title, message } = req.body;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Canal invalido' });

  const embed = new EmbedBuilder()
    .setColor('#2563eb')
    .setTitle(title || 'ANUNCIO OFICIAL')
    .setDescription(message)
    .setFooter({ text: `Enviado desde TamayoBOT Dashboard por ${session.user.username}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  addAuditLog(guildId, session.user.username, `Envio un anuncio a #${channel.name}`);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor y Dashboard TamayoBOT System listos en http://localhost:${PORT}`);
});

client.login(TOKEN);