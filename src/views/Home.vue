<template>
  <div class="home">
    <Editor />
    <Geoms :geoms="geoms"/>
  </div>
</template>

<script lang='ts'>
// @ is an alias to /src
import Editor from '@/components/Editor.vue'
import Geoms from '@/components/Geoms.vue'
import { out } from '@/geom/play'

export default {
  name: 'Home',
  data: () => { //eslint-disable-line
    return {
      geoms: out
    }
  },
  components: {
    Geoms, Editor
  }
}
</script>

<style lang="stylus" scoped>
.home
  height 100%
  display grid
  grid-column 1 / 3
  grid-row 2 / 3
  grid-template-columns subgrid
  grid-template-rows subgrid

.editor
  grid-column 1 / 2

.geoms
  grid-column 2 / 3

</style>
