#!/usr/bin/env python3
"""
Migration: Fix corrupted rooms_available, rooms_sold, occupancy_pct, adr, revpar
for SpringHill Suites Lakeland (130-room hotel).
"""

import json
import math
import urllib.request
import urllib.error

import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qrryydgpujoumgotemfk.supabase.co")
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # must be set in environment
ROOMS = 130

# Leap year check
def is_leap(year):
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)

# Days in month
def days_in_month(year, month):
    days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if month == 2 and is_leap(year):
        return 29
    return days[month]

def correct_rooms_available(year, month):
    return ROOMS * days_in_month(year, month)

def api_request(method, path, body=None):
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()}")
        return None

# Fetch all rows
print("Fetching all monthly_periods rows...")
rows = api_request("GET", "/rest/v1/monthly_periods?select=period,year,month,rooms_available,rooms_sold,occupancy_pct,adr,revpar,room_revenue&order=period.asc")
if not rows:
    print("Failed to fetch data")
    exit(1)

print(f"Found {len(rows)} rows")

fixes = []
for r in rows:
    period = r["period"]
    year = r["year"]
    month = r["month"]
    ra_actual = r["rooms_available"]
    rs_actual = r["rooms_sold"]
    occ_actual = r["occupancy_pct"]
    adr_actual = r["adr"]
    revpar_actual = r["revpar"]
    room_rev = r["room_revenue"]

    correct_ra = correct_rooms_available(year, month)

    # Determine if this row needs fixing
    needs_fix = False
    if ra_actual is None or abs(ra_actual - correct_ra) > 100:
        needs_fix = True
    elif rs_actual is not None and (rs_actual > 4200 or rs_actual < 0):
        needs_fix = True

    if not needs_fix:
        continue

    update = {"rooms_available": correct_ra}

    # Recalculate rooms_sold
    if occ_actual is not None and 0.0 < occ_actual < 1.2:
        # Trust occupancy_pct
        new_rs = round(occ_actual * correct_ra)
    elif room_rev is not None and room_rev > 0 and adr_actual is not None and adr_actual > 0:
        # Use room_revenue / adr
        new_rs = round(room_rev / adr_actual)
    else:
        new_rs = rs_actual  # can't compute, leave as is

    update["rooms_sold"] = new_rs

    # Recalculate occupancy_pct
    if new_rs is not None and new_rs > 0:
        update["occupancy_pct"] = round(new_rs / correct_ra, 4)

    # Recalculate adr and revpar only if room_revenue is positive
    if room_rev is not None and room_rev > 0 and new_rs is not None and new_rs > 0:
        update["adr"] = round(room_rev / new_rs)
        update["revpar"] = round(room_rev / correct_ra)

    fixes.append((period, update, r))

print(f"\nRows to fix: {len(fixes)}")
for period, update, orig in fixes:
    print(f"\n  {period}:")
    print(f"    ra: {orig['rooms_available']} → {update.get('rooms_available')}")
    print(f"    rs: {orig['rooms_sold']} → {update.get('rooms_sold')}")
    print(f"    occ: {orig['occupancy_pct']} → {update.get('occupancy_pct')}")
    if 'adr' in update:
        print(f"    adr: {orig['adr']} → {update.get('adr')}")
    if 'revpar' in update:
        print(f"    revpar: {orig['revpar']} → {update.get('revpar')}")

print("\nApplying fixes...")
for period, update, orig in fixes:
    result = api_request(
        "PATCH",
        f"/rest/v1/monthly_periods?period=eq.{period}",
        update
    )
    if result is not None:
        print(f"  ✓ Fixed {period}")
    else:
        print(f"  ✗ FAILED {period}")

print("\nDone!")
