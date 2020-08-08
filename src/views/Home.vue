<template>
  <div class="home">
    <Editor :value='source' @change='updateSource'/>
    <Geoms :geoms="geoms"/>
  </div>
</template>

<script lang='ts'>
// @ is an alias to /src
import Editor from '@/components/Editor.vue'
import Geoms from '@/components/Geoms.vue'

import { parse } from '@/parser/parser'
import { geom_set_from_conjunction, build_construction_plan } from '@/geom/planner'
import { execute_plan } from '@/geom/plan_executer'

export default {
  name: 'Home',
  data: () => { //eslint-disable-line
    return {
      geoms: {},
      source: ''
    }
  },
  methods: {
    updateSource (text) {
      this.$data.source = text
      this.updateGeoms()
    },
    updateGeoms () {
      const ast = parse(this.$data.source)
      const geom_set = geom_set_from_conjunction(ast)
      const plan = build_construction_plan(geom_set)
      this.$data.geoms = execute_plan(plan)
      console.log(plan)
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
