import { Command, Args } from '@oclif/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { ApiClient, formatApiError } from '../lib/apiClient';

interface TomlSkill {
  id: string;
  name: string;
  summary: string;
  version: string;
  tags: string[];
  author: string;
  instructions: string;
}

// Minimal parser for the skill.toml structure defined in SPEC §5.2
function parseSkillToml(content: string): TomlSkill {
  const result: Record<string, string | string[]> = {};
  let section = '';
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Section header (skip [[...]])
    if (/^\[[^\[]+\]$/.test(line)) {
      section = line.slice(1, -1).replace(/\./g, '_');
      i++;
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) { i++; continue; }

    const key = `${section}__${line.slice(0, eqIdx).trim()}`;
    const valueRaw = line.slice(eqIdx + 1).trim();

    if (valueRaw.startsWith('"""')) {
      // Multi-line string
      let body = valueRaw.slice(3);
      while (!body.includes('"""') && i + 1 < lines.length) {
        i++;
        body += '\n' + lines[i];
      }
      const endIdx = body.indexOf('"""');
      result[key] = body.slice(0, endIdx).trim();
    } else if (valueRaw.startsWith('[')) {
      // Inline array
      const inner = valueRaw.slice(1, valueRaw.lastIndexOf(']'));
      result[key] = inner
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      // Scalar string
      result[key] = valueRaw.replace(/^["']|["']$/g, '');
    }

    i++;
  }

  const req = (k: string): string => {
    const v = result[k];
    if (!v) throw new Error(`skill.toml missing field: ${k.replace('skill__', '[skill] ')}`);
    return Array.isArray(v) ? v.join(', ') : v;
  };

  return {
    id: req('skill__id'),
    name: req('skill__name'),
    summary: req('skill__summary'),
    version: result['skill__version'] as string ?? '1.0.0',
    tags: Array.isArray(result['skill__tags']) ? result['skill__tags'] as string[] : [],
    author: result['skill__author'] as string ?? '',
    instructions: result['usage__instructions'] as string ?? '',
  };
}

export default class Publish extends Command {
  static description = 'Pack and upload a skill from skill.toml';
  static args = { path: Args.string({ description: 'Path to skill directory', default: '.' }) };

  async run(): Promise<void> {
    const { args } = await this.parse(Publish);
    const skillDir = path.resolve(args.path);
    const tomlPath = path.join(skillDir, 'skill.toml');

    if (!fs.existsSync(tomlPath)) {
      this.error(`No skill.toml found in ${skillDir}`);
    }

    const tomlContent = fs.readFileSync(tomlPath, 'utf-8');
    let parsed: TomlSkill;
    try {
      parsed = parseSkillToml(tomlContent);
    } catch (err) {
      this.error(`Failed to parse skill.toml: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Pack directory into tarball for checksum
    const tmpFile = path.join(os.tmpdir(), `tklens-publish-${Date.now()}.tar.gz`);
    try {
      execSync(`tar czf "${tmpFile}" -C "${skillDir}" .`, { stdio: 'pipe' });
    } catch (err) {
      this.error(`Failed to pack skill directory: ${err instanceof Error ? err.message : String(err)}`);
    }

    const tarball = fs.readFileSync(tmpFile);
    const checksum = crypto.createHash('sha256').update(tarball).digest('hex');
    fs.unlinkSync(tmpFile);

    this.log(`Publishing ${parsed.id} v${parsed.version}...`);

    const client = new ApiClient();
    let skill: { id: string };
    try {
      skill = await client.post<{ id: string }>('/api/v1/skills', {
        id: parsed.id,
        name: parsed.name,
        summary: parsed.summary,
        usage: parsed.instructions || undefined,
        tags: parsed.tags.length > 0 ? parsed.tags : undefined,
        author: parsed.author || undefined,
        origin: 'local',
        latest_version: parsed.version,
        // TODO(spec): no blob upload endpoint yet; checksum stored for future use
        payload_uri: '',
        checksum,
      });
    } catch (err) {
      this.error(formatApiError(err));
    }

    this.log(`Published: ${skill.id}`);
  }
}
