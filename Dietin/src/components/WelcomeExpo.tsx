import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useUserStore } from '@/stores/userStore';
import type { UserProfile, Gender, Goal } from '@/lib/types';

// A minimal, Expo/React Native compatible version of the Welcome screen.
// Dependencies removed: react-router-dom, DOM APIs, framer-motion, lucide-react, react-chartjs-2, tailwind, sonner, localStorage.
// Navigation: expose optional callbacks via props so you can wire with React Navigation in Expo.

export type WelcomeExpoProps = {
  onNavigate?: (route: string) => void; // e.g., navigation.navigate('Home')
  onGoBack?: () => void;
  homeRouteName?: string; // default: 'Home'
  authRouteName?: string; // default: 'Auth'
};

export default function WelcomeExpo({ onNavigate, onGoBack, homeRouteName = 'Home', authRouteName = 'Auth' }: WelcomeExpoProps) {
  const { t, i18n } = useTranslation();
  const { updateUser } = useUserStore();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);
  const [useMetric, setUseMetric] = useState(true);
  const [isNameValid, setIsNameValid] = useState(false);
  const [aiResult, setAiResult] = useState<{
    goal: string;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
    estimatedWeeks?: number;
    bmi?: number;
  } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const validateName = (raw: string): boolean => {
    const name = (raw || '').trim();
    if (!name) return false;
    if (name.length < 2 || name.length > 40) return false;
    if (/[^\p{L}\p{M}\s'’-]/u.test(name)) return false;
    if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(name)) return false;
    if (/(.)\1{2,}/.test(name)) return false;
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    if (tokens.some((t) => t.length < 2)) return false;
    if (!/^[\p{L}]/u.test(name)) return false;
    const lower = name.toLowerCase();
    const blacklist = ['asdf', 'qwerty', 'zxcv', 'test', 'name', 'abc', 'unknown', 'n/a', 'na', 'none', 'null', 'user', 'me', 'idk'];
    if (blacklist.some((b) => lower === b || lower.includes(b))) return false;
    return true;
  };

  const updateForm = (updates: Partial<UserProfile>) => setFormData((prev) => ({ ...prev, ...updates }));

  const convertToMetric = (ft: number, inches: number) => {
    const totalInches = ft * 12 + (inches || 0);
    return Math.round(totalInches * 2.54);
  };

  const convertToImperial = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  const convertWeight = (weight: number, toMetric: boolean) => (toMetric ? Math.round(weight * 0.453592) : Math.round(weight / 0.453592));

  const computeUserAnalysis = (data: Partial<UserProfile>, metric: boolean) => {
    const weightKg = data.weight ? (metric ? data.weight : convertWeight(data.weight, true)) : 0;
    const heightCm = data.height ? (metric ? data.height : convertToMetric((data.heightFt as number) || 0, (data.heightIn as number) || 0)) : 0;

    const getAge = () => {
      if (data.birthYear && data.birthMonth !== undefined && data.birthDay) {
        const y = Number(data.birthYear);
        const m = Number(data.birthMonth);
        const d = Number(data.birthDay);
        const dob = new Date(y, m, d);
        if (!isNaN(dob.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const mdiff = today.getMonth() - dob.getMonth();
          if (mdiff < 0 || (mdiff === 0 && today.getDate() < dob.getDate())) age--;
          return Math.max(14, Math.min(90, age));
        }
      }
      return 30;
    };

    const age = getAge();
    const gender = ((data.gender as any) || 'male') as 'male' | 'female';

    const bmr = gender === 'male' ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5 : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const activityId = (data.activityLevel as string) || 'moderate';
    const activityMap: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9, veryActive: 1.9 };
    const multiplier = activityMap[activityId] || 1.55;

    const tdee = bmr * multiplier;
    const goal = (data.goal as string) || 'maintain';
    let calories = tdee;
    if (goal === 'lose' || goal === 'lose_weight' || goal === 'fat_loss') calories = tdee * 0.85;
    if (goal === 'gain' || goal === 'muscle_gain') calories = tdee * 1.15;

    const protein = Math.max(60, Math.round(1.8 * weightKg));
    const fat = Math.max(35, Math.round(0.8 * weightKg));
    const remaining = Math.max(0, Math.round(calories) - protein * 4 - fat * 9);
    const carbs = Math.max(0, Math.round(remaining / 4));

    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? +(weightKg / (heightM * heightM)).toFixed(1) : 0;

    return { metabolism: Math.round(bmr), calories: Math.round(calories), protein, carbs, fat, bmi } as const;
  };

  const isHeightValid = () => {
    if (useMetric) return !!formData.height && formData.height >= 120 && formData.height <= 220;
    const heightFt = formData.heightFt || 0;
    const heightIn = formData.heightIn || 0;
    return heightFt >= 4 && heightFt <= 7 && heightIn >= 0 && heightIn <= 11;
  };

  const isWeightValid = () => {
    if (!formData.weight) return false;
    return useMetric ? formData.weight >= 30 && formData.weight <= 180 : formData.weight >= 66 && formData.weight <= 400;
  };

  const isStepValid = useMemo(() => {
    switch (step) {
      case 1:
        return !!formData.name && formData.name.trim().length > 0 && isNameValid;
      case 2:
        return (
          formData.birthMonth !== undefined &&
          formData.birthMonth !== null &&
          formData.birthDay !== undefined &&
          formData.birthDay !== null &&
          formData.birthYear !== undefined &&
          formData.birthYear !== null
        );
      case 3:
        return !!formData.gender;
      case 4:
        return isHeightValid() && isWeightValid();
      default:
        return true;
    }
  }, [step, formData, isNameValid, useMetric]);

  const next = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 600) return;
    setLastInteractionTime(now);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (step < 6) setStep((s) => s + 1);
  };

  const back = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 600) return;
    setLastInteractionTime(now);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onNavigate?.(authRouteName);
    } catch (e) {
      console.error(e);
      Alert.alert(t('auth.signOutFailed', { defaultValue: "We couldn't sign you out. Please try again." }));
    }
  };

  const handleGetStarted = async () => {
    const now = Date.now();
    if (now - lastInteractionTime < 600) return;
    setLastInteractionTime(now);

    setIsLoading(true);
    try {
      const unitSystem = useMetric ? 'METRIC' : 'IMPERIAL';
      const heightCm = formData.height ?? null;
      const heightImperial = heightCm ? convertToImperial(heightCm) : null;
      const heightFt = formData.heightFt ?? heightImperial?.feet ?? null;
      const heightIn = formData.heightIn ?? heightImperial?.inches ?? null;
      const rawWeight = formData.weight ?? null;
      const weightKg = rawWeight === null ? null : useMetric ? rawWeight : convertWeight(rawWeight, true);
      const weightLbs = rawWeight === null ? null : useMetric ? convertWeight(rawWeight, false) : rawWeight;

      const baseUserData = {
        name: formData.name || '',
        email: auth.currentUser?.email || '',
        username: formData.name || '',
        age: formData.age || null,
        height: heightCm,
        weight: weightKg,
        bodyFatPercentage: formData.bodyFatPercentage || null,
        unitSystem,
        heightCm,
        heightFt,
        heightIn,
        weightKg,
        weightLbs,
        calorieGoal: aiResult?.calories || 2000,
        metabolism: aiResult?.metabolism || 2200,
        proteinGoal: aiResult?.protein || Math.round((aiResult?.calories || 2000) * 0.3 / 4),
        carbsGoal: aiResult?.carbs || Math.round((aiResult?.calories || 2000) * 0.4 / 4),
        fatGoal: aiResult?.fat || Math.round((aiResult?.calories || 2000) * 0.3 / 9),
        birthMonth: formData.birthMonth || null,
        birthDay: formData.birthDay || null,
        birthYear: formData.birthYear || null,
        targetWeight: formData.targetWeight || null,
        weeklyGoal: formData.weeklyGoal || null,
        diet: formData.diet || null,
        regionPreference: formData.regionPreference || null,
        goal: formData.goal || null,
        goals: formData.goals || [],
        obstacles: formData.obstacles || [],
        source: formData.source || null,
        hasTriedOtherApps: formData.hasTriedOtherApps || 'NO',
        gender: formData.gender || null,
        activityLevel: formData.activityLevel || null,
        experienceLevel: formData.experienceLevel || 'BEGINNER',
        workoutDays: formData.workoutDays || null,
        injuries: Array.isArray(formData.injuries) ? formData.injuries : [],
        allergies: Array.isArray(formData.allergies) ? formData.allergies : [],
        onboardingCompleted: true,
        lastUpdated: new Date().toISOString(),
        streak: 0,
        lastLoginDate: new Date().toISOString(),
        totalMealsLogged: 0,
        totalWorkoutsLogged: 0,
        weeklyStats: {},
        monthlyStats: {},
        yearlyStats: {},
        customTags: [],
        notificationsEnabled: true,
        theme: 'dark',
        language: i18n.language || 'en',
      } as const;

      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          await updateDoc(userRef, baseUserData as any);
        } else {
          await setDoc(userRef, {
            ...(baseUserData as any),
            isPro: false,
            proExpiryDate: null,
            dailyImageAnalysis: 0,
            dailyMealAnalysis: 0,
            lastQuotaReset: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
          });
        }

        updateUser(baseUserData as any);
        onNavigate?.(homeRouteName);
      } else {
        throw new Error('No authenticated user found');
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      Alert.alert(t('profile.saveFailed', { defaultValue: "We couldn't save your profile. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Recompute analysis when critical fields change
    const res = computeUserAnalysis(formData, useMetric);
    setAiResult(res as any);
  }, [formData, useMetric]);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.name.title', "What's your name?")}</Text>
            <TextInput
              placeholder={t('welcome.name.placeholder', 'Enter your name')}
              value={formData.name || ''}
              onChangeText={(text) => {
                setIsNameValid(validateName(text));
                updateForm({ name: text });
              }}
              autoCapitalize="words"
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
            />
            {!!formData.name && !isNameValid && (
              <Text style={{ color: '#ef4444' }}>{t('welcome.name.error', 'Please enter a real name (letters only, 2-40 chars).')}</Text>
            )}
          </View>
        );
      case 2:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.birth.title', 'When were you born?')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                placeholder={t('welcome.birth.month', 'Month (0-11)')}
                keyboardType="number-pad"
                value={formData.birthMonth !== undefined && formData.birthMonth !== null ? String(formData.birthMonth) : ''}
                onChangeText={(v) => updateForm({ birthMonth: Number(v) as any })}
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
              />
              <TextInput
                placeholder={t('welcome.birth.day', 'Day')}
                keyboardType="number-pad"
                value={formData.birthDay !== undefined && formData.birthDay !== null ? String(formData.birthDay) : ''}
                onChangeText={(v) => updateForm({ birthDay: Number(v) as any })}
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
              />
              <TextInput
                placeholder={t('welcome.birth.year', 'Year')}
                keyboardType="number-pad"
                value={formData.birthYear !== undefined && formData.birthYear !== null ? String(formData.birthYear) : ''}
                onChangeText={(v) => updateForm({ birthYear: Number(v) as any })}
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
              />
            </View>
          </View>
        );
      case 3:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.gender.title', 'Choose your gender')}</Text>
            {(['MALE', 'FEMALE'] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => updateForm({ gender: g })}
                style={{ padding: 14, borderRadius: 12, backgroundColor: formData.gender === g ? '#111827' : '#fff', borderWidth: 1, borderColor: '#e5e7eb' }}
              >
                <Text style={{ color: formData.gender === g ? '#fff' : '#111827', textAlign: 'center', fontWeight: '600' }}>
                  {g === 'MALE' ? t('welcome.gender.options.male', 'Male') : t('welcome.gender.options.female', 'Female')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 4:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.hw.title', 'Height & weight')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>{t('welcome.hw.units.imperial', 'Imperial')}</Text>
              <Switch
                value={useMetric}
                onValueChange={(val) => {
                  setUseMetric(val);
                  if (formData.weight) updateForm({ weight: convertWeight(formData.weight, val) });
                  if (!val && formData.height) {
                    const { feet, inches } = convertToImperial(formData.height);
                    updateForm({ heightFt: feet as any, heightIn: inches as any });
                  }
                  if (val && formData.heightFt !== undefined) {
                    const newCm = convertToMetric((formData.heightFt as number) || 0, (formData.heightIn as number) || 0);
                    updateForm({ height: newCm as any });
                  }
                }}
              />
              <Text>{t('welcome.hw.units.metric', 'Metric')}</Text>
            </View>
            {useMetric ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  placeholder={t('welcome.hw.heightCm', 'Height (cm)')}
                  keyboardType="number-pad"
                  value={formData.height ? String(formData.height) : ''}
                  onChangeText={(v) => updateForm({ height: Number(v) as any })}
                  style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
                />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder={t('welcome.hw.heightFt', 'Height ft')}
                  keyboardType="number-pad"
                  value={formData.heightFt !== undefined && formData.heightFt !== null ? String(formData.heightFt) : ''}
                  onChangeText={(v) => updateForm({ heightFt: Number(v) as any })}
                  style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
                />
                <TextInput
                  placeholder={t('welcome.hw.heightIn', 'Height in')}
                  keyboardType="number-pad"
                  value={formData.heightIn !== undefined && formData.heightIn !== null ? String(formData.heightIn) : ''}
                  onChangeText={(v) => updateForm({ heightIn: Number(v) as any })}
                  style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
                />
              </View>
            )}
            <TextInput
              placeholder={useMetric ? t('welcome.hw.weightKg', 'Weight (kg)') : t('welcome.hw.weightLbs', 'Weight (lbs)')}
              keyboardType="number-pad"
              value={formData.weight ? String(formData.weight) : ''}
              onChangeText={(v) => updateForm({ weight: Number(v) as any })}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16 }}
            />
          </View>
        );
      case 5:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.goal.title', 'Choose your goal')}</Text>
            {(['LOSE_WEIGHT', 'GAIN_MUSCLE', 'RECOMPOSITION', 'MAINTAIN_HEALTH'] as Goal[]).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => updateForm({ goal: g })}
                style={{ padding: 14, borderRadius: 12, backgroundColor: formData.goal === g ? '#111827' : '#fff', borderWidth: 1, borderColor: '#e5e7eb' }}
              >
                <Text style={{ color: formData.goal === g ? '#fff' : '#111827', textAlign: 'center', fontWeight: '600' }}>{g.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 6:
      default:
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700' }}>{t('welcome.summary.title', 'Summary')}</Text>
            {!!aiResult && (
              <View style={{ padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
                <Text>{t('welcome.ai.metabolism', 'Metabolism')}: {aiResult.metabolism} kcal</Text>
                <Text>{t('welcome.ai.calories', 'Calories')}: {aiResult.calories} kcal</Text>
                <Text>{t('welcome.ai.protein', 'Protein')}: {aiResult.protein} g</Text>
                <Text>{t('welcome.ai.carbs', 'Carbs')}: {aiResult.carbs} g</Text>
                <Text>{t('welcome.ai.fat', 'Fat')}: {aiResult.fat} g</Text>
              </View>
            )}
            <TouchableOpacity onPress={handleGetStarted} style={{ padding: 16, borderRadius: 12, backgroundColor: '#16a34a' }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{t('welcome.cta.getStarted', 'Get Started')}</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {renderStep()}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <TouchableOpacity onPress={back} disabled={step <= 1} style={{ padding: 12, borderRadius: 10, backgroundColor: step <= 1 ? '#e5e7eb' : '#111827' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={next} disabled={!isStepValid || step >= 6} style={{ padding: 12, borderRadius: 10, backgroundColor: !isStepValid || step >= 6 ? '#e5e7eb' : '#111827' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.next', 'Next')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: '#ef4444' }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{t('auth.signOut', 'Sign out')}</Text>
        </TouchableOpacity>
      </ScrollView>
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)'
          }}
        >
          <ActivityIndicator size="large" color="#111827" />
        </View>
      )}
    </View>
  );
}
