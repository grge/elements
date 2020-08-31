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
import { geom_set_from_conjunction, greedy_planner } from '@/geom/planner'
import { execute_plan_at, get_random_params, test_cost, optimise_real_params, optimise_params } from '@/geom/plan_executer'

export default {
  name: 'Home',
  data: () => { //eslint-disable-line
    return {
      geoms: {},
      params: [],
      plan: null,
      source: ''
    }
  },
  methods: {
    updateSource (text) {
      this.$data.source = text
      const ast = parse(this.$data.source)
      const geom_set = geom_set_from_conjunction(ast)
      this.$data.plan = greedy_planner(geom_set)
      this.$data.params = get_random_params(this.$data.plan)
      this.$data.params = optimise_params(this.$data.plan, this.$data.params, test_cost)
      this.$data.plan.forEach((el) => {
        console.log(el.constructor.name, el.in_geom_names, el.out_geom_name)
      })
      console.log(this.$data.plan)
      this.updateGeoms()
    },
    updateGeoms () {
      this.$data.geoms = execute_plan_at(this.$data.plan, this.$data.params)
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
