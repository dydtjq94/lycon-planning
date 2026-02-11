"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "../AdminContext";
import styles from "./reports.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface MonthlyStats {
  month: string;
  newCustomers: number;
  completedConsultations: number;
  totalBookings: number;
}

interface FunnelData {
  registered: number;
  onboarded: number;
  booked: number;
  completed: number;
}

export default function ReportsPage() {
  const { expertId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData>({
    registered: 0,
    onboarded: 0,
    booked: 0,
    completed: 0,
  });
  const [totalStats, setTotalStats] = useState({
    totalCustomers: 0,
    completedThisMonth: 0,
    bookingRate: 0,
  });

  useEffect(() => {
    loadReportData();
  }, []);

  async function loadReportData() {
    const supabase = createClient();

    // conversations + bookings 병렬
    const [conversationsRes, bookingsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select(`
          id,
          user_id,
          created_at,
          profiles:user_id (
            id,
            created_at,
            onboarding_step
          )
        `)
        .eq("expert_id", expertId),
      supabase
        .from("bookings")
        .select("*")
        .eq("expert_id", expertId),
    ]);

    const conversations = conversationsRes.data;
    const bookings = bookingsRes.data;

    if (conversations && bookings) {
      // Calculate funnel data
      type ProfileData = { id: string; created_at: string; onboarding_step: string | null };
      const profiles = conversations.map((c) => {
        const p = c.profiles;
        if (Array.isArray(p)) {
          return p[0] as ProfileData | undefined;
        }
        return p as ProfileData | null;
      }).filter((p): p is ProfileData => p !== null && p !== undefined);

      const registered = profiles.length;
      const onboarded = profiles.filter((p) => p?.onboarding_step === "completed").length;
      const usersWithBookings = new Set(bookings.map((b) => b.user_id)).size;
      const completedBookings = bookings.filter((b) => b.status === "completed").length;

      setFunnelData({
        registered,
        onboarded,
        booked: usersWithBookings,
        completed: completedBookings,
      });

      // Calculate monthly stats for last 6 months
      const now = new Date();
      const monthlyData: MonthlyStats[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = `${monthDate.getMonth() + 1}월`;

        const newCustomers = profiles.filter((p) => {
          const created = p?.created_at ? new Date(p.created_at) : null;
          if (!created) return false;
          return (
            created.getFullYear() === monthDate.getFullYear() &&
            created.getMonth() === monthDate.getMonth()
          );
        }).length;

        const monthBookings = bookings.filter((b) => {
          const date = new Date(b.booking_date);
          return (
            date.getFullYear() === monthDate.getFullYear() &&
            date.getMonth() === monthDate.getMonth()
          );
        });

        monthlyData.push({
          month: monthLabel,
          newCustomers,
          completedConsultations: monthBookings.filter((b) => b.status === "completed").length,
          totalBookings: monthBookings.length,
        });
      }

      setMonthlyStats(monthlyData);

      // Calculate total stats
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const completedThisMonth = bookings.filter((b) => {
        const date = new Date(b.booking_date);
        return (
          b.status === "completed" &&
          date.getFullYear() === currentYear &&
          date.getMonth() === currentMonth
        );
      }).length;

      setTotalStats({
        totalCustomers: registered,
        completedThisMonth,
        bookingRate: registered > 0 ? Math.round((usersWithBookings / registered) * 100) : 0,
      });
    }

    setLoading(false);
  }

  const barChartData = {
    labels: monthlyStats.map((s) => s.month),
    datasets: [
      {
        label: "신규 고객",
        data: monthlyStats.map((s) => s.newCustomers),
        backgroundColor: "#007aff",
        borderRadius: 6,
      },
      {
        label: "상담 완료",
        data: monthlyStats.map((s) => s.completedConsultations),
        backgroundColor: "#34c759",
        borderRadius: 6,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const funnelChartData = {
    labels: ["가입", "온보딩 완료", "예약", "상담 완료"],
    datasets: [
      {
        data: [
          funnelData.registered,
          funnelData.onboarded,
          funnelData.booked,
          funnelData.completed,
        ],
        backgroundColor: ["#007aff", "#5856d6", "#ff9500", "#34c759"],
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
    cutout: "60%",
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>고객 현황</h1>
        </div>

        <div className={styles.content}>
          {/* Stats Grid Skeleton */}
          <div className={styles.statsGrid}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.statCard}>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: "100px" }} />
                <div className={`${styles.skeleton} ${styles.skeletonValue}`} style={{ width: "80px" }} />
              </div>
            ))}
          </div>

          {/* Charts Grid Skeleton */}
          <div className={styles.chartsGrid}>
            {[1, 2].map((i) => (
              <div key={i} className={styles.chartCard}>
                <div className={`${styles.skeleton} ${styles.skeletonTitle}`} style={{ width: "120px" }} />
                <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>고객 현황</h1>
      </div>

      <div className={styles.content}>
        {/* Summary Stats */}
        <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>전체 고객</span>
          <span className={styles.statValue}>{totalStats.totalCustomers}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>이번 달 상담 완료</span>
          <span className={styles.statValue}>{totalStats.completedThisMonth}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>예약 전환율</span>
          <span className={styles.statValue}>{totalStats.bookingRate}%</span>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {/* Monthly Trend */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>월별 추이</h2>
          <div className={styles.chartContainer}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

        {/* Customer Funnel */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>고객 퍼널</h2>
          <div className={styles.chartContainer}>
            <Doughnut data={funnelChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Funnel Breakdown */}
      <div className={styles.funnelBreakdown}>
        <h2 className={styles.chartTitle}>퍼널 상세</h2>
        <div className={styles.funnelSteps}>
          <div className={styles.funnelStep}>
            <div className={styles.funnelStepBar} style={{ width: "100%" }} />
            <div className={styles.funnelStepInfo}>
              <span className={styles.funnelStepLabel}>가입</span>
              <span className={styles.funnelStepValue}>{funnelData.registered}</span>
            </div>
          </div>
          <div className={styles.funnelStep}>
            <div
              className={styles.funnelStepBar}
              style={{
                width: funnelData.registered > 0
                  ? `${(funnelData.onboarded / funnelData.registered) * 100}%`
                  : "0%",
                backgroundColor: "#5856d6",
              }}
            />
            <div className={styles.funnelStepInfo}>
              <span className={styles.funnelStepLabel}>온보딩 완료</span>
              <span className={styles.funnelStepValue}>
                {funnelData.onboarded}
                {funnelData.registered > 0 && (
                  <span className={styles.funnelStepPercent}>
                    ({Math.round((funnelData.onboarded / funnelData.registered) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className={styles.funnelStep}>
            <div
              className={styles.funnelStepBar}
              style={{
                width: funnelData.registered > 0
                  ? `${(funnelData.booked / funnelData.registered) * 100}%`
                  : "0%",
                backgroundColor: "#ff9500",
              }}
            />
            <div className={styles.funnelStepInfo}>
              <span className={styles.funnelStepLabel}>예약</span>
              <span className={styles.funnelStepValue}>
                {funnelData.booked}
                {funnelData.registered > 0 && (
                  <span className={styles.funnelStepPercent}>
                    ({Math.round((funnelData.booked / funnelData.registered) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className={styles.funnelStep}>
            <div
              className={styles.funnelStepBar}
              style={{
                width: funnelData.registered > 0
                  ? `${(funnelData.completed / funnelData.registered) * 100}%`
                  : "0%",
                backgroundColor: "#34c759",
              }}
            />
            <div className={styles.funnelStepInfo}>
              <span className={styles.funnelStepLabel}>상담 완료</span>
              <span className={styles.funnelStepValue}>
                {funnelData.completed}
                {funnelData.registered > 0 && (
                  <span className={styles.funnelStepPercent}>
                    ({Math.round((funnelData.completed / funnelData.registered) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
