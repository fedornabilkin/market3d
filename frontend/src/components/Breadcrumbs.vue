<template lang="pug">
el-breadcrumb(separator="/" style="margin-bottom: 20px")
  el-breadcrumb-item(v-for="item in items" :key="item.path")
    router-link(v-if="item.path" :to="item.path") {{ item.label }}
    span(v-else) {{ item.label }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

const route = useRoute();

const items = computed<BreadcrumbItem[]>(() => {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Главная', path: '/' },
  ];

  const pathMap: Record<string, string> = {
    '/clusters': 'Кластеры',
    '/printers': 'Принтеры',
    '/orders': 'Заказы',
    '/profile': 'Профиль',
    '/login': 'Вход',
    '/register': 'Регистрация',
  };

  const path = route.path;
  const pathParts = path.split('/').filter(p => p);

  if (pathParts.length === 0) {
    return [{ label: 'Главная' }];
  }

  // First level
  const firstLevel = `/${pathParts[0]}`;
  if (pathMap[firstLevel]) {
    breadcrumbs.push({ label: pathMap[firstLevel], path: firstLevel });
  }

  // Second level (detail pages)
  if (pathParts.length > 1) {
    const secondLevel = pathParts[1];
    if (secondLevel === 'create') {
      breadcrumbs.push({ label: 'Создание' });
    } else if (secondLevel === 'edit') {
      breadcrumbs.push({ label: 'Редактирование' });
    } else if (!isNaN(Number(secondLevel))) {
      // It's an ID
      if (pathParts[0] === 'clusters') {
        breadcrumbs.push({ label: `Кластер #${secondLevel}` });
      } else if (pathParts[0] === 'printers') {
        breadcrumbs.push({ label: `Принтер #${secondLevel}` });
      } else if (pathParts[0] === 'orders') {
        breadcrumbs.push({ label: `Заказ #${secondLevel}` });
      }
    }
  }

  return breadcrumbs;
});
</script>

<style scoped>
</style>
