import fs from 'fs'
import path from 'path'
import SettingsClient, { type ChangelogEntry } from './SettingsClient'
import packageJson from '../../../../package.json'

function parseChangelog(md: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  for (const line of md.split('\n')) {
    const m = line.match(/^## \[(.+?)\] - (.+)/)
    if (m) {
      if (current) entries.push(current)
      current = { version: m[1], date: m[2].trim(), notes: [] }
    } else if (current && line.startsWith('- ')) {
      current.notes.push(line.slice(2).trim())
    }
  }
  if (current) entries.push(current)
  return entries
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams
  const md = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf-8')
  const changelog = parseChangelog(md)
  return <SettingsClient changelog={changelog} version={packageJson.version} setup={setup === '1'} />
}
