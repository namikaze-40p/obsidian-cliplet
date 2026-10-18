export const Platform = { isMacOS: false, isIosApp: false };

export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}
