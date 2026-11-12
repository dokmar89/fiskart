/** Where a project's thumbnail lives, relative to DATA_DIR. */
export function thumbnailPath(projectId: string): string {
  return `thumbnails/${projectId}.png`;
}
