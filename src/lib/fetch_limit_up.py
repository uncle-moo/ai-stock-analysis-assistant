import akshare as ak
import json
import sys
from datetime import datetime, timedelta

def get_last_trading_day():
    try:
        # 获取上证指数最近行情
        df = ak.stock_zh_index_daily_em(symbol="sh000001")
        if not df.empty:
            return df.iloc[-1]['date'].strftime('%Y%m%d')
    except:
        pass
    # 兜底
    today = datetime.now()
    if today.weekday() == 5: # Sat
        return (today - timedelta(days=1)).strftime('%Y%m%d')
    if today.weekday() == 6: # Sun
        return (today - timedelta(days=2)).strftime('%Y%m%d')
    return today.strftime('%Y%m%d')

def fetch_limit_up():
    try:
        last_day = get_last_trading_day()
        print(f"Fetching limit up data for date: {last_day}", file=sys.stderr)
        
        # 使用 akshare 获取涨停池
        df = ak.stock_zt_pool_em(date=last_day)
        
        if df.empty:
            print(json.dumps([]))
            return

        # 转换为我们需要的格式
        stocks = []
        for _, row in df.iterrows():
            # AKShare 返回的列名可能包含空格，需注意
            # 根据测试：['序号', '代码', '名称', '涨跌幅', '最新价', '成交额', '流通市值', '总市值', '换手率', '封板资金', '首次封板时间', '最后封板时间', '炸板次数', '涨停统计', '连板数', '所属行业']
            # 注意：没有最高价、开盘价、最低价，我们用最新价代替来判断是否一字板（AKShare 没直接提供一字板标记，但可以通过首次封板时间判断）
            
            # 判断一字板：如果首次封板时间是 09:25:00 且 炸板次数为 0
            first_seal = str(row.get('首次封板时间', ''))
            is_one_word = first_seal == '092500' and int(row.get('炸板次数', 1)) == 0

            stocks.append({
                "f12": str(row['代码']),
                "f14": str(row['名称']),
                "f2": float(row['最新价']),
                "f3": float(row['涨跌幅']),
                "f6": float(row['成交额']),
                "f15": float(row['最新价']), # 暂时替代
                "f17": float(row['最新价']), # 暂时替代
                "f18": float(row['最新价']), # 暂时替代
                "f100": str(row['所属行业']).strip(),
                "f161": int(row['连板数']) if '连板数' in row else 1,
                "is_one_word_force": is_one_word # 强制一字标记
            })
        
        print(json.dumps(stocks, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))

if __name__ == "__main__":
    fetch_limit_up()
