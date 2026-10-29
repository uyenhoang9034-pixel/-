import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, Options } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import cron from 'node-cron';

import config from './config/application.js';
import { initializeDatabase } from './utils/database.js';
import { getGuildConfig } from './services/config/guildConfig.js';
import { getServerCounters, saveServerCounters, updateCounter } from './services/serverstatsService.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import { checkBirthdays } from './services/birthdayService.js';
import { checkGiveaways } from './services/giveawayService.js';
import { pumpkinGrowthTracker } from './services/pumpkinGrowthTracker.js';
import { loadCommands, registerCommands as registerSlashCommands } from './handlers/loaders/commandLoader.js';
import { runSafeTask, handleTaskError, ErrorCodes } from './utils/errorHandler.js';
import { initializeMusic, initRiffyAfterReady } from './services/music/riffySetup.js';
import { shutdownMusic } from './services/music/playerHandler.js';
import pkg from '../package.json' with { type: 'json' };
import { EXPECTED_SCHEMA_VERSION, EXPECTED_SCHEMA_LABEL } from './config/database/schemaVersion.js';

class TitanBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,                        
        GatewayIntentBits.GuildMembers,                 

        GatewayIntentBits.GuildMessages,                
        GatewayIntentBits.GuildMessageReactions,        
        GatewayIntentBits.MessageContent,               
        GatewayIntentBits.DirectMessages,

        GatewayIntentBits.GuildVoiceStates,             

        GatewayIntentBits.GuildBans,                    
      ],
      partials: [
        Partials.GuildMember,
        Partials.User,
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
      ],
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        // Tối ưu cache tin nhắn: 15 tin nhắn/channel là hoàn hảo cho các game chat & prefix mà cực nhẹ RAM
        MessageManager: 15,
        // Loại bỏ hoàn toàn cache của các module không sử dụng hoặc fetch khi cần
        ApplicationCommandManager: 0,
        AutoModerationRuleManager: 0,
        BaseGuildEmojiManager: 0,
        GuildBanManager: 0,
        GuildInviteManager: 0,
        GuildScheduledEventManager: 0,
        GuildStickerManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        ThreadManager: 0,
        ThreadMemberManager: 0,
        // Giới hạn số lượng thành viên và người dùng trong RAM (bảo lưu bot và người đang trong voice)
        GuildMemberManager: {
          maxSize: 200,
          keepOverLimit: (member) => member.id === member.client.user?.id || Boolean(member.voice?.channelId),
        },
        UserManager: {
          maxSize: 200,
          keepOverLimit: (user) => user.id === user.client.user?.id,
        },
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        // Quét tin nhắn không hoạt động sau 4 phút (chu kỳ 2 phút một lần)
        messages: {
          interval: 120,
          lifetime: 240,
        },
        // Tự động giải phóng guild member không hoạt động sau mỗi 5 phút (trừ bot và người đang voice)
        guildMembers: {
          interval: 300,
          filter: () => (member) => member.id !== member.client.user?.id && !member.voice?.channelId,
        },
        // Dọn dẹp user cache không cần thiết sau mỗi 5 phút
        users: {
          interval: 300,
          filter: () => (user) => user.id !== user.client.user?.id,
        },
        threads: {
          interval: 1800,
          lifetime: 1800,
        },
        threadMembers: {
          interval: 1800,
          filter: () => () => true,
        },
      },
    });

    this.config = config;
    this.commands = new Collection();
    this.events = new Collection();
    this.buttons = new Collection();
    this.selectMenus = new Collection();
    this.modals = new Collection();
    this.cooldowns = new Collection();
    this.db = null;
    this.rest = new REST({ version: '10' }).setToken(config.bot.token);
  }

  async start() {
    try {
      startupLog('Starting TitanBot...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      startupLog('Initializing database...');
      const dbInstance = await initializeDatabase();
      this.db = dbInstance.db;

      // Check database status and report
      const dbStatus = this.db.getStatus();
      if (dbStatus.isDegraded) {
        logger.warn('');
        logger.warn('╔═══════════════════════════════════════════════════════╗');
        logger.warn('║ ⚠️  DATABASE RUNNING IN DEGRADED MODE                 ║');
        logger.warn('║                                                       ║');
        logger.warn('║ Connection: In-Memory Storage (PostgreSQL unavailable)║');
        logger.warn('║ Data Persistence: DISABLED - data lost on restart    ║');
        logger.warn('║ Action Required: Fix PostgreSQL and restart bot      ║');
        logger.warn('╚═══════════════════════════════════════════════════════╝');
        logger.warn('');
      } else {
        startupLog(`✅ Database Status: ${dbStatus.connectionType} (fully operational)`);
      }

      // Nạp và đồng bộ dữ liệu Witch Hunter từ PostgreSQL (bảo toàn dữ liệu vĩnh viễn)
      try {
        const { witchHunterStorage } = await import('./services/witchHunterService.js');
        await witchHunterStorage.syncWithPersistentDb();
      } catch (whErr) {
        logger.warn('⚠️ [WitchHunter] Không thể nạp dữ liệu từ PostgreSQL:', whErr.message);
      }

      try {
        const { witchHunterQuestStorage } = await import('./services/witchHunterQuestService.js');
        await witchHunterQuestStorage.syncWithPersistentDb();
      } catch (qErr) {
        logger.warn('⚠️ [WitchHunterQuest] Không thể nạp dữ liệu nhiệm vụ từ PostgreSQL:', qErr.message);
      }

      try {
        const { witchHunterSummonStorage } = await import('./services/witchHunterSummonService.js');
        await witchHunterSummonStorage.syncWithPersistentDb();
      } catch (sErr) {
        logger.warn('⚠️ [WitchHunterSummon] Không thể nạp dữ liệu triệu hồi từ PostgreSQL:', sErr.message);
      }
      
      startupLog('Starting web server...');
      this.startWebServer();
      
      startupLog('Loading commands...');
      await loadCommands(this);
      startupLog(`Commands loaded: ${this.commands.size}`);
      
      startupLog('Loading handlers...');
      await this.loadHandlers();
      startupLog('Handlers loaded');

      initializeMusic(this);
      
      startupLog('Logging into Discord...');
      await this.login(this.config.bot.token);
      startupLog('Discord login successful');

      // Riffy must be initialized only after Discord is ready and client.user.id exists.
      // Tiên Tôn already follows this lifecycle; without it Ma Tôn can play through
      // Lavalink but Riffy track events (including trackStart/dashboard) are unreliable.
      initRiffyAfterReady(this);

      // Khởi tạo vòng đời World Boss và kích hoạt Watchdog kiểm tra hết giờ tự động
      try {
        const { witchHunterWorldBossService } = await import('./services/witchHunterWorldBossService.js');
        await witchHunterWorldBossService.initClient(this);
      } catch (wbErr) {
        logger.warn('⚠️ [WorldBoss] Lỗi khởi tạo World Boss Service cùng Client:', wbErr.message);
      }
      
      startupLog('Registering slash commands globally...');
      await this.registerCommands();
      startupLog('Slash commands registration complete');
      
      const databaseMode = dbStatus.isDegraded
        ? 'Optional in-memory mode (data resets after restart)'
        : 'Connected (persistent data enabled)';
      const handlerSummary = `${this.buttons.size} buttons, ${this.selectMenus.size} menus, ${this.modals.size} modals`;
      startupLog(
        `ONLINE ✅ | ${this.commands.size} commands loaded | ${handlerSummary} | Database: ${databaseMode}`
      );
      
      this.setupCronJobs();
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  startWebServer() {
    const app = express();
    const configuredPort = Number(this.config.api?.port || process.env.PORT || 3000);
    const maxPortRetryAttempts = Number(process.env.PORT_RETRY_ATTEMPTS || 5);
    const host = process.env.WEB_HOST || '0.0.0.0';
    const corsOrigin = this.config.api?.cors?.origin || '*';
    
    app.use((req, res, next) => {
      const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    const requestCounts = new Map();
    const windowMs = this.config.api?.rateLimit?.windowMs || 60000;
    const maxRequests = this.config.api?.rateLimit?.max || 100;
    
    app.use((req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
      }
      
      const times = requestCounts.get(ip).filter(t => t > windowStart);
      
      if (times.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      times.push(now);
      requestCounts.set(ip, times);

      // Định kỳ dọn dẹp các IP đã hết hạn để tránh rò rỉ RAM
      if (requestCounts.size > 100) {
        for (const [keyIp, ipTimes] of requestCounts.entries()) {
          const validTimes = ipTimes.filter(t => t > windowStart);
          if (validTimes.length === 0) {
            requestCounts.delete(keyIp);
          } else {
            requestCounts.set(keyIp, validTimes);
          }
        }
      }

      next();
    });

    app.get('/health', (req, res) => {
      // Trả về 204 No Content (0 byte body) cho các dịch vụ ping Uptime (UptimeRobot, Railway healthcheck...)
      // nhằm triệt tiêu hoàn toàn băng thông Egress tích tụ hàng tháng.
      // Quản trị viên vẫn có thể xem JSON chi tiết bằng cách gọi /health?full=true.
      if (req.query?.full === 'true') {
        const dbStatus = this.db?.getStatus?.() || { isDegraded: 'unknown' };
        const status = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: {
            connected: dbStatus.connectionType !== 'none',
            degraded: dbStatus.isDegraded,
            type: dbStatus.connectionType
          }
        };
        return res.status(200).json(status);
      }

      res.status(204).end();
    });

    app.get('/ready', (req, res) => {
      const dbStatus = this.db?.getStatus?.() || { isDegraded: true, connectionType: 'none' };
      const isReady = this.isReady() && !dbStatus.isDegraded;

      const metrics = {
        guildCount: this.guilds?.cache?.size ?? 0,
        commandCount: this.commands?.size ?? 0,
        database: {
          mode: dbStatus.connectionType,
          degraded: dbStatus.isDegraded,
          degradedReason: dbStatus.degradedReason ?? null,
        },
        schemaVersion: EXPECTED_SCHEMA_VERSION,
        schemaLabel: EXPECTED_SCHEMA_LABEL,
      };

      if (isReady) {
        return res.status(200).json({
          ready: true,
          message: 'Bot is ready',
          metrics,
        });
      }

      res.status(503).json({
        ready: false,
        reason: !this.isReady() ? 'Bot not Ready' : 'Database degraded',
        metrics,
      });
    });

    app.get('/', (req, res) => {
      res.status(200).json({ 
        message: 'TitanBot System Online',
        version: pkg.version,
        timestamp: new Date().toISOString()
      });
    });

    const startServer = (port, attempt = 0) => {
      let hasStartedListening = false;
      const server = app.listen(port, host, () => {
        hasStartedListening = true;
        this.webServer = server;
        startupLog(`✅ Web Server running on ${host}:${port}`);
        startupLog(`Health endpoint: http://${host}:${port}/health`);
        startupLog(`Ready endpoint: http://${host}:${port}/ready`);
      });

      server.on('error', (error) => {
        const errorCode = error?.code || 'UNKNOWN_ERROR';
        const errorMessage = error?.message || 'Unknown server error';

        if (!hasStartedListening && errorCode === 'EADDRINUSE' && attempt < maxPortRetryAttempts) {
          const nextPort = port + 1;
          startupLog(`Port ${port} is already in use. Trying port ${nextPort}...`);
          setTimeout(() => startServer(nextPort, attempt + 1), 250);
          return;
        }

        if (hasStartedListening && errorCode === 'EADDRINUSE') {
          logger.warn(`Web server reported a duplicate bind warning on ${host}:${port}, but the bot remains online.`);
          return;
        }

        logger.error(`❌ Web server error on port ${port} (${errorCode}): ${errorMessage}`);

        if (!hasStartedListening) {
          process.exit(1);
        }
      });
    };

    startServer(configuredPort, 0);
  }

  setupCronJobs() {
    cron.schedule('0 0 * * *', runSafeTask('birthday_check', () => checkBirthdays(this)), { timezone: 'Asia/Ho_Chi_Minh' });
    cron.schedule('0 0 * * *', runSafeTask('pumpkin_daily_flush', () => pumpkinGrowthTracker.flushDailyReport(this)), { timezone: 'Asia/Ho_Chi_Minh' });
    cron.schedule('* * * * *', runSafeTask('giveaway_check', () => checkGiveaways(this)));
    // Cron job kiểm tra an toàn World Boss hết hạn (mỗi 1 phút) - tự động chốt kết thúc và phát thưởng
    cron.schedule('* * * * *', runSafeTask('witch_hunter_world_boss_check', async () => {
      try {
        const { witchHunterWorldBossService } = await import('./services/witchHunterWorldBossService.js');
        await witchHunterWorldBossService.checkExpiredBoss(this);
      } catch (err) {
        logger.error('❌ [WorldBoss] Lỗi cron kiểm tra World Boss hết hạn:', err);
      }
    }));
    cron.schedule('*/15 * * * *', runSafeTask('counter_update', () => this.updateAllCounters()));
    // Tối ưu RAM định kỳ mỗi 30 phút: dọn dẹp cache hết hạn & thu hồi rác GC
    cron.schedule('*/30 * * * *', runSafeTask('memory_cleanup', () => this.cleanupMemory()));

    // Hồi phục sinh lực tự nhiên cho Supporter (+10% HP / 1 giờ)
    cron.schedule('0 * * * *', runSafeTask('supporter_hp_regen', async () => {
      try {
        const { WitchHunterService, witchHunterStorage } = await import('./services/witchHunterService.js');
        const allUsers = witchHunterStorage.getAllUsers();
        for (const u of allUsers) {
          if (u.supporter_hp && Object.keys(u.supporter_hp).length > 0) {
            WitchHunterService.updateNaturalRegen(u);
          }
        }
      } catch (err) {
        logger.error('❌ [WitchHunterExpedition] Lỗi cron hồi phục sinh lực Supporter:', err);
      }
    }));

    // Sự kiện Thí Luyện Cuối Tuần (Witch Hunter): Mở lúc 20:00 Thứ Bảy
    cron.schedule('0 20 * * 6', runSafeTask('witch_hunter_puzzle_open', async () => {
      try {
        const { WitchHunterQuestService } = await import('./services/witchHunterQuestService.js');
        for (const [, guild] of this.guilds.cache) {
          const channel = guild.channels.cache.find((c) => c.name === 'giai-ma-co-ngu');
          if (channel && channel.isTextBased()) {
            const embed = WitchHunterQuestService.buildPuzzleNoticeEmbed();
            const row = WitchHunterQuestService.buildPuzzleNoticeButton();
            await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
          }
        }
      } catch (err) {
        logger.error('❌ [WitchHunterQuest] Lỗi khi tự động mở puzzle cuối tuần:', err);
      }
    }), { timezone: 'Asia/Ho_Chi_Minh' });

    // Sự kiện Thí Luyện Cuối Tuần (Witch Hunter): Đóng lúc 23:59 Chủ Nhật
    cron.schedule('59 23 * * 0', runSafeTask('witch_hunter_puzzle_close', async () => {
      try {
        for (const [, guild] of this.guilds.cache) {
          const channel = guild.channels.cache.find((c) => c.name === 'giai-ma-co-ngu');
          if (channel && channel.isTextBased()) {
            await channel.send('⏳ **Cánh Cổng Cổ Ngữ Đã Khép Lại!** Thí Luyện Cuối Tuần tuần này đã kết thúc. Hẹn gặp lại các chiến binh vào 20:00 tối Thứ Bảy tuần sau nhé! ✨').catch(() => null);
          }
        }
      } catch (err) {
        logger.error('❌ [WitchHunterQuest] Lỗi khi thông báo đóng puzzle cuối tuần:', err);
      }
    }), { timezone: 'Asia/Ho_Chi_Minh' });
  }

  cleanupMemory() {
    try {
      // 1. Dọn dẹp cache hết hạn trong memory storage fallback nếu có
      if (this.db?.cleanupExpired) {
        this.db.cleanupExpired();
      } else if (this.db?.db?.cleanupExpired) {
        this.db.db.cleanupExpired();
      }

      // 2. Kích hoạt V8 Garbage Collection thu hồi RAM thực tế về hệ điều hành
      if (typeof global.gc === 'function') {
        const memBefore = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        global.gc();
        const memAfter = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
        logger.info(`[Memory] Usagi thu dọn rác GC: Heap ${memBefore}MB -> ${memAfter}MB (RSS: ${rss}MB)`);
      } else {
        const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
        logger.debug(`[Memory] Thông số RAM: Heap ${memUsed}MB | RSS ${rss}MB`);
      }
    } catch (err) {
      logger.warn('[Memory] Lỗi trong quá trình dọn dẹp RAM:', err?.message || err);
    }
  }

  async updateAllCounters() {
    if (!this.db) {
      logger.warn('Database not available for counter updates');
      return;
    }
    
    for (const [guildId, guild] of this.guilds.cache) {
      try {
        const counters = await getServerCounters(this, guildId);
        const validCounters = [];
        const orphanedCounters = [];
        
        for (const counter of counters) {
          if (counter && counter.type && counter.channelId && counter.enabled !== false) {
            const channel = guild.channels.cache.get(counter.channelId);
            if (channel) {
              validCounters.push(counter);
              await updateCounter(this, guild, counter);
            } else {
              orphanedCounters.push(counter);
              logger.info(`Removing orphaned counter ${counter.id} (type: ${counter.type}, deleted channel: ${counter.channelId}) from guild ${guildId}`);
            }
          }
        }
        
        // Save cleaned counters if any were orphaned
        // Save cleaned counters if any were orphaned
        if (orphanedCounters.length > 0) {
          await saveServerCounters(this, guildId, validCounters);
          logger.info(`Cleaned up ${orphanedCounters.length} orphaned counter(s) from guild ${guildId} during scheduled update`);
        }
      } catch (error) {
        logger.error(`Error updating counters for guild ${guildId}:`, error);
      }
    }
  }

  async loadHandlers() {
    startupLog('Loading handlers...');
    const handlers = [
      { path: 'events', type: 'default', required: true },
      { path: 'interactions', type: 'default', required: true }
    ];

    for (const handler of handlers) {
      try {
        startupLog(`Loading handler: ${handler.path}`);
        const module = await import(`./handlers/loaders/${handler.path}.js`);
        const loaderFn = handler.type.startsWith('named:')
          ? module[handler.type.split(':')[1]]
          : module.default;

        if (typeof loaderFn === 'function') {
          await loaderFn(this);
          startupLog(`✅ Loaded ${handler.path}`);
        } else {
          throw new Error(`Invalid loader export from ${handler.path}`);
        }
      } catch (error) {
        if (handler.required) {
          logger.error(`❌ Failed to load required handler ${handler.path}:`, error.message);
          throw error;
        } else if (error.code !== 'MODULE_NOT_FOUND') {
          logger.warn(`⚠️  Failed to load optional handler ${handler.path}:`, error.message);
        }
      }
    }
  }

  async registerCommands() {
    try {
      await registerSlashCommands(this, { clientId: this.config.bot.clientId });
    } catch (error) {
      logger.error('Error registering commands:', error);
    }
  }

  async shutdown(reason = 'UNKNOWN') {
    shutdownLog(`Bot is shutting down (${reason})...`);
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🛑 Graceful Shutdown Initiated (${reason})`);
    logger.info(`${'='.repeat(60)}`);

    try {
      
      logger.info('Stopping cron jobs...');
      cron.getTasks().forEach(task => task.stop());
      logger.info('✅ Cron jobs stopped');

      logger.info('Stopping music players...');
      await shutdownMusic(this);
      logger.info('✅ Music players stopped');

      if (this.webServer) {
        logger.info('Closing web server...');
        await new Promise((resolve) => this.webServer.close(resolve));
        logger.info('✅ Web server closed');
      }

      // Close database connection
      // Close database connection
      if (this.db && this.db.db) {
        logger.info('Closing database connection...');
        try {
          if (this.db.db.pool) {
            await this.db.db.pool.end();
            logger.info('✅ Database connection closed');
          }
        } catch (error) {
          logger.warn('Error closing database pool:', error.message);
        }
      }

      logger.info('Destroying Discord client...');
      if (this.isReady()) {
        try {
          this.destroy();
          logger.info('✅ Discord client destroyed');
        } catch (error) {

          logger.warn('Discord client destroy warning (non-critical):', error.message);
        }
      }

      logger.info('✅ Graceful shutdown complete');
  shutdownLog('Bot stopped successfully.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

try {
  const bot = new TitanBot();
  
  const setupShutdown = () => {
    process.on('SIGTERM', () => bot.shutdown('SIGTERM'));
    process.on('SIGINT', () => bot.shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      // Process state may be corrupt after an uncaught throw; log and shut down cleanly.
      handleTaskError('uncaught_exception', error, { fatal: true });
      bot.shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      const code = reason?.code;
      if (code === 10062 || code === 40060 || code === 50027) {
        logger.warn('Recoverable Discord interaction rejection:', reason?.message || reason);
        return;
      }
      if (reason?.message?.includes('Queue is empty')) {
        return;
      }

      // A stray rejection is a bug to fix, not a reason to take the bot down.
      // Log loudly with full context; the central task handler categorizes it.
      handleTaskError('unhandled_rejection', reason instanceof Error ? reason : new Error(String(reason)), {
        errorCode: ErrorCodes.UNHANDLED_REJECTION,
      });
    });
  };
  
  setupShutdown();
  bot.start().catch((error) => {
    logger.error('Fatal error during bot startup:', error);
    bot.shutdown('STARTUP_ERROR');
  });
} catch (error) {
  logger.error('Fatal error during bot startup:', error);
  process.exit(1);
}

export default TitanBot;