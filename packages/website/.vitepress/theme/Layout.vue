<template>
  <Layout>
    <template #doc-before>
      <div v-if="frontmatter.laravelDocs" class="custom-block warning">
        <p class="custom-block-title">⚠️ Note</p>
        <p>
          This page is a copy of the Laravel documentation and has not been updated for Aku yet.
        </p>
      </div>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
</script>

<style scoped>
.custom-block.warning {
  border-color: #e7c000;
  color: #6b5900;
  background-color: rgba(255, 197, 23, 0.1);
  margin: 16px 0;
  border-left-width: 4px;
  border-left-style: solid;
  padding: 12px 24px 12px 20px;
  border-radius: 4px;
}

.custom-block-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.custom-block p {
  margin: 0;
  line-height: 1.7;
}
</style>
