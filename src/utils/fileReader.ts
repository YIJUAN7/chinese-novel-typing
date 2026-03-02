/**
 * 读取本地文本文件
 * @param file - 文件对象
 * @returns Promise<string> 文件内容
 */
export const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(content)
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsText(file)
  })
}

/**
 * 验证文件是否为 txt 格式
 * @param file - 文件对象
 * @returns boolean 是否为 txt 文件
 */
export const isTxtFile = (file: File): boolean => {
  return file.type === 'text/plain' || file.name.endsWith('.txt')
}

/**
 * 验证文件大小是否在限制范围内
 * @param file - 文件对象
 * @param maxSizeMB - 最大文件大小（MB）
 * @returns boolean 是否在限制范围内
 */
export const isFileSizeValid = (file: File, maxSizeMB: number = 10): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}
