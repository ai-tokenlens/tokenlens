import { Command, Flags } from '@oclif/core';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CRON_MARKER = '# tokenlens-collect';
const CRON_LINE = `*/20 * * * * tklens collect --since=$(date -d "20 minutes ago" --iso-8601=seconds)  ${CRON_MARKER}`;
const TASK_NAME = 'TokenLens-Collect';

export default class CollectSchedule extends Command {
  static description = 'Schedule tklens collect to run automatically every 20 minutes';

  static flags = {
    unschedule: Flags.boolean({
      description: 'Remove the scheduled crontab entry or Task Scheduler task',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CollectSchedule);

    if (process.platform === 'win32') {
      await this.handleWindows(flags.unschedule ?? false);
    } else {
      await this.handleUnix(flags.unschedule ?? false);
    }
  }

  private async handleWindows(unschedule: boolean): Promise<void> {
    if (unschedule) {
      try {
        execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, { stdio: 'pipe' });
        this.log(`Task Scheduler task "${TASK_NAME}" removed.`);
      } catch (err) {
        this.error(`Failed to remove task: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      try {
        execSync(
          `schtasks /Create /TN "${TASK_NAME}" /TR "tklens collect" /SC MINUTE /MO 20 /F`,
          { stdio: 'pipe' },
        );
        this.log(`Created Task Scheduler task: ${TASK_NAME}`);
        this.log('To remove: tklens collect-schedule --unschedule');
        this.log(`Or via PowerShell: schtasks /Delete /TN "${TASK_NAME}" /F`);
      } catch (err) {
        this.error(`Failed to create task: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async handleUnix(unschedule: boolean): Promise<void> {
    const getCurrentCrontab = (): string => {
      try { return execSync('crontab -l', { encoding: 'utf-8' }); } catch { return ''; }
    };

    if (unschedule) {
      const current = getCurrentCrontab();
      const filtered = current.split('\n').filter(l => !l.includes(CRON_MARKER)).join('\n').trim();
      try {
        if (filtered) {
          const tmp = path.join(os.tmpdir(), `tklens-cron-${Date.now()}.txt`);
          fs.writeFileSync(tmp, filtered + '\n');
          execSync(`crontab ${tmp}`, { stdio: 'pipe' });
          fs.unlinkSync(tmp);
        } else {
          // Remove all crontab entries (was the only line)
          execSync('crontab -r', { stdio: 'pipe' });
        }
        this.log('TokenLens crontab entry removed.');
      } catch (err) {
        this.error(`Failed to update crontab: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      const current = getCurrentCrontab().trim();
      if (current.includes(CRON_MARKER)) {
        this.log('TokenLens crontab entry already exists. Use --unschedule to remove it first.');
        return;
      }
      const newCrontab = current ? `${current}\n${CRON_LINE}` : CRON_LINE;
      try {
        const tmp = path.join(os.tmpdir(), `tklens-cron-${Date.now()}.txt`);
        fs.writeFileSync(tmp, newCrontab + '\n');
        execSync(`crontab ${tmp}`, { stdio: 'pipe' });
        fs.unlinkSync(tmp);
        this.log(`Added crontab entry:\n  ${CRON_LINE}`);
        this.log('To remove: tklens collect-schedule --unschedule');
      } catch (err) {
        this.error(`Failed to update crontab: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
