import { toZonedTime } from 'date-fns-tz'

const PACIFIC = 'America/Los_Angeles'
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function buildCourtEmail(
  session: { starts_at: string; court_count: number },
  participants: { display_name: string }[],
): { subject: string; body: string } {
  const dow = WEEKDAYS[toZonedTime(new Date(session.starts_at), PACIFIC).getDay()]
  const names = participants.map((p, i) => `${i + 1}. ${p.display_name}`).join('\n')
  return {
    subject: `Yi Shen Group ${dow}预约名单`,
    body: `Lily您好，\n\nYi Shen, Miaoyan Li 和 Xuan Bai 已预订今日${session.court_count}片场地。\n\n以下为本次菜狗群参与人员名单：\n\n${names}\n\n谢谢！\n-菜狗群AI管理员`,
  }
}
