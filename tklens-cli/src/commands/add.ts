import { Command, Args, Flags } from '@oclif/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { ApiClient, formatApiError } from '../lib/apiClient';

function detectTarget(cwd: string): string {
  if (fs.existsSync(path.join(cwd, '.claude'))) return 'claude-code';
  if (fs.existsSync(path.join(cwd, '.copilot'))) return 'copilot';
  return 'claude-code'; // default
}

export default class Add extends Command {
  static description = 'Download and materialize a skill into cwd';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };
  static flags = {
    target: Flags.string({ description: 'Target tool', options: ['auto', 'claude-code', 'copilot'], default: 'auto' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Add);
    const cwd = process.cwd();

    const target = flags.target === 'auto' ? detectTarget(cwd) : flags.target;
    this.log(`Target: ${target}`);

    const client = new ApiClient();
    let tarball: Buffer;
    try {
      tarball = await client.getBuffer(`/api/v1/skills/${args.skillId}/download?target=${target}`);
    } catch (err) {
      this.error(formatApiError(err));
    }

    const tmpFile = path.join(os.tmpdir(), `tklens-${args.skillId}-${Date.now()}.tar.gz`);
    fs.writeFileSync(tmpFile, tarball);

    let files: string[] = [];
    try {
      const listing = execSync(`tar tzf "${tmpFile}"`, { encoding: 'utf-8' });
      files = listing.trim().split('\n').filter(f => f && !f.endsWith('/'));
    } catch (err) {
      fs.unlinkSync(tmpFile);
      this.error(`Failed to inspect tarball: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      execSync(`tar xzf "${tmpFile}" -C "${cwd}"`, { stdio: 'pipe' });
    } catch (err) {
      this.error(`Failed to extract tarball: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      fs.unlinkSync(tmpFile);
    }

    this.log(`Extracted ${files.length} file(s):`);
    for (const f of files) {
      this.log(`  ${f}`);
    }
  }
}
