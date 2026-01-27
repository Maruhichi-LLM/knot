export function VotingAnonymousBanner() {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 shadow-sm">
      <h2 className="text-sm font-semibold">この投票は匿名です</h2>
      <p className="mt-1 text-sm text-sky-900/90">
        誰がどれを選んだかは、作成者・管理者を含めて一切表示されません。
        表示されるのは票数（集計）のみです。
      </p>
      <p className="mt-2 text-xs text-sky-700">
        1人1票です（投票のやり直しはできません）。
      </p>
    </div>
  );
}
