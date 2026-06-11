/**
 * 文件说明：统一处理大厅房间码输入的格式化和前端校验规则。
 */
export function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

export function validateRoomCode(roomCode: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    return "请输入房间码。";
  }

  if (!/^[A-Z0-9]{4,8}$/.test(normalizedRoomCode)) {
    return "房间码需为 4 到 8 位大写字母或数字。";
  }

  return "";
}
