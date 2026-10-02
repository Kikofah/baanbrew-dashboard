# ตรวจตัวเลขในข้อความสรุปของ FixedChart1–5 ด้วย pandas (รันใน Colab ได้)
# อัปโหลด sales_clean.csv และ products.csv แล้วตั้ง FROM / TO / BRANCH ให้ตรงกับตัวกรองบนแดชบอร์ด
import pandas as pd

SALES, PRODUCTS = "sales_clean.csv", "products.csv"
FROM, TO, BRANCH = "2026-08-22", "2026-09-20", None  # BRANCH = None คือทุกสาขา

d = pd.read_csv(SALES)
d["date"] = d["datetime"].str[:10]
d["revenue"] = d["qty"] * d["unit_price"]
d = d[(d.date >= FROM) & (d.date <= TO)]
if BRANCH:
    d = d[d.branch == BRANCH]
names = pd.read_csv(PRODUCTS).set_index("product_id")["product_name"]
pct = lambda v: f"{v * 100:+.1f}%"

# กราฟ 1: เมนูขายดี (ข้ามแถวที่ product_id ว่าง)
m = d.dropna(subset=["product_id"]).groupby("product_id").revenue.sum().sort_values(ascending=False)
share = m / m.sum()
print("กราฟ 1:", names[m.index[0]], f"฿{m.iloc[0]:,.0f}", f"({share.iloc[0]:.1%})",
      f"มากกว่าอันดับ 2 ({names[m.index[1]]}) ฿{m.iloc[0] - m.iloc[1]:,.0f}",
      f"· 10 อันดับแรกรวม {share.iloc[:10].sum():.1%} จาก {len(m)} เมนู")

# กราฟ 2: ยอดรวมสาขา
b = d.groupby("branch").revenue.sum().sort_values(ascending=False)
print("กราฟ 2:", b.index[0], f"฿{b.iloc[0]:,.0f}", f"= {b.iloc[0] / b.iloc[-1]:.1f} เท่าของ", b.index[-1], f"฿{b.iloc[-1]:,.0f}")

# กราฟ 3: ค่าเฉลี่ย 7 วัน (วันที่ไม่มีขายนับเป็น 0) และ n วันล่าสุดเทียบ n วันแรก
def daily(df):
    return df.groupby("date").revenue.sum()
days = daily(d)
cal = days.reindex(pd.date_range(days.index.min(), days.index.max()).strftime("%Y-%m-%d"), fill_value=0)
n = min(84, len(days) // 2)
growth = lambda s: s.iloc[-n:].mean() / s.iloc[:n].mean() - 1
first_day = d.groupby("branch").date.min()
new = first_day[first_day > d.date.min()].index.tolist()
line = f"กราฟ 3: ค่าเฉลี่ย 7 วันล่าสุด ฿{cal.iloc[-7:].mean():,.0f}/วัน · {n} วันล่าสุด {pct(growth(days))}"
if new:
    line += f" · ไม่นับ {', '.join(new)} {pct(growth(daily(d[~d.branch.isin(new)])))}"
print(line)

# กราฟ 4: ยอดเฉลี่ยต่อวันรายเดือน (หารด้วยจำนวนวันที่มีข้อมูล)
mo = d.assign(month=d.date.str[:7]).groupby("month").agg(revenue=("revenue", "sum"), days=("date", "nunique"))
mo["per_day"] = mo.revenue / mo.days
last = mo.iloc[-1]
full = pd.Period(mo.index[-1]).days_in_month
line = f"กราฟ 4: {mo.index[-1]} ข้อมูล {int(last.days)}/{full} วัน · ฿{last.per_day:,.0f}/วัน"
if len(mo) > 1:
    line += f" {pct(last.per_day / mo.per_day.iloc[-2] - 1)} เทียบ {mo.index[-2]}"
print(line)

# กราฟ 5: แต่ละสาขาเทียบกับตัวเอง (ช่วงล่าสุด vs ช่วงก่อนหน้าที่ยาวเท่ากัน ปัดเป็นสัปดาห์เต็ม)
start, end = pd.Timestamp(d.date.min()), pd.Timestamp(d.date.max())
k = ((end - start).days + 1) // 14 * 7
if k == 0:
    print("กราฟ 5: ช่วงสั้นกว่า 14 วัน")
else:
    cur_from, prev_from = end - pd.Timedelta(days=k - 1), end - pd.Timedelta(days=2 * k - 1)
    dt = pd.to_datetime(d.date)
    cur = d[dt >= cur_from].groupby("branch").revenue.sum()
    prev = d[(dt >= prev_from) & (dt < cur_from)].groupby("branch").revenue.sum()
    ok = first_day[pd.to_datetime(first_day) <= prev_from].index
    g = (cur[ok] / prev[ok] - 1).sort_values(ascending=False)
    print(f"กราฟ 5: {k} วันล่าสุด ({cur_from:%Y-%m-%d}–{end:%Y-%m-%d}):",
          " · ".join(f"{br} {pct(v)}" for br, v in g.items()),
          f"· ยังเทียบไม่ได้: {', '.join(first_day.index.difference(ok))}" if len(ok) < len(first_day) else "")
