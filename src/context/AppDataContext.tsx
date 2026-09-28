'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProjects, getStudents, getDashboardStats, ProjectRecord, StudentRecord } from '@/actions/studentActions';
import { getDailyFoodList, FoodListDetails } from '@/actions/foodListActions';
import { getFoodTokens } from '@/actions/tokenActions';

interface AppDataContextType {
  projects: ProjectRecord[];
  students: StudentRecord[];
  dashboardStats: any;
  dailyFoodList: FoodListDetails | null;
  foodTokens: any[];
  loading: boolean;
  refreshProjects: () => Promise<void>;
  refreshStudents: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  refreshFoodList: (date?: string) => Promise<void>;
  refreshTokens: (date?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [dailyFoodList, setDailyFoodList] = useState<FoodListDetails | null>(null);
  const [foodTokens, setFoodTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error('Failed refreshing projects:', e);
    }
  }, []);

  const refreshStudents = useCallback(async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (e) {
      console.error('Failed refreshing students:', e);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setDashboardStats(data);
    } catch (e) {
      console.error('Failed refreshing dashboard:', e);
    }
  }, []);

  const refreshFoodList = useCallback(async (date?: string) => {
    try {
      const data = await getDailyFoodList(date);
      setDailyFoodList(data);
    } catch (e) {
      console.error('Failed refreshing food list:', e);
    }
  }, []);

  const refreshTokens = useCallback(async (date?: string) => {
    try {
      const data = await getFoodTokens(date);
      setFoodTokens(data);
    } catch (e) {
      console.error('Failed refreshing tokens:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      refreshDashboard(),
      refreshProjects(),
      refreshStudents(),
      refreshFoodList(),
      refreshTokens(),
    ]);
    setLoading(false);
  }, [refreshDashboard, refreshProjects, refreshStudents, refreshFoodList, refreshTokens]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <AppDataContext.Provider
      value={{
        projects,
        students,
        dashboardStats,
        dailyFoodList,
        foodTokens,
        loading,
        refreshProjects,
        refreshStudents,
        refreshDashboard,
        refreshFoodList,
        refreshTokens,
        refreshAll,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
