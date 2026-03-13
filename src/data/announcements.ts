// 公告接口定义
export interface Announcement {
  id: string           // 公告唯一标识（用于判断是否已读）
  title: string        // 公告标题
  content: string      // 公告内容（支持 HTML）
  date: string         // 发布日期
}

// 公告列表（按发布日期倒序排列，最新的在前面）
export const announcements: Announcement[] = [
  {
    id: '20260313-001',
    title: '添加主题切换功能',
    content: `
      <ul style="margin-left:1.5rem">
        <li>新增设置按钮，可以切换三种主题</li>
        <li>添加了一个深色主题，以及一个绿色护眼主题。</li>
      </ul>
    `,
    date: '2026-03-13'
  }
]
