// 顶部声明条：常驻、不可关闭，提醒这是测试网教学项目，不是真实交易所。
export function NoticeBar() {
  return (
    <div className="notice" role="alert">
      <span className="notice-icon">⚠️</span>
      <span>
        <b>本站为测试网教学项目，并非真实交易所。</b>
        所有代币均为测试币、没有任何真实价值；行情数据仅作参考。请勿向本站任何地址转入真实资产。
      </span>
    </div>
  );
}
