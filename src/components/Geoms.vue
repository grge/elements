<template>
  <div class="hello">
    <svg width='100%' height='500px' viewBox='-25 -25 50 50'>
      <circle class='circle' :key='c.name' v-for='c in circles' :cx='c.Cx' :cy='c.Cy' :r='c.r'/>
      <circle class='point' :key='p.name' v-for='p in points' :cx='p.x' :cy='p.y' r='0.7'/>
    </svg>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class Geoms extends Vue {
  @Prop() private geoms: object

  get points() { // eslint-disable-line
    const names = Object.keys(this.geoms).filter((n) => n.includes('point'))
    return names.map((n) => { return { ...this.geoms[n], name: n } })
  }
  get circles() { // eslint-disable-line
    const names = Object.keys(this.geoms).filter((n) => n.includes('circle'))
    return names.map((n) => { return { ...this.geoms[n], name: n } })
  }
}
</script>

<style scoped lang="stylus">
.circle
  stroke black
  stroke-width 0.2
  fill none

.point
  fill red
</style>
