<template>
  <div class="geoms">
    <svg class='geoms-svg' viewBox='-25 -25 50 50'>
      <circle class='circle' :key='c.name' v-for='c in circles' :cx='c.Cx' :cy='c.Cy' :r='c.r'/>
      <line class='line' :key='l.name' v-for='l in lines' :x1='l.x1' :y1='l.y1' :x2='l.x2' :y2='l.y2'/>
      <circle class='point' :key='p.name' v-for='p in points' :cx='p.x' :cy='p.y' r='0.7'/>
      <text class='label' :x='p.x' :y='p.y' :key='"label"+p.name' v-for='p in points'>{{p.name}}</text>
    </svg>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { Line } from '@/geom/geom'

@Component
export default class Geoms extends Vue {
  @Prop() private geoms: object

  get points() { // eslint-disable-line
    const names = Object.keys(this.geoms).filter((n) => n.includes('point'))
    return names.map((n) => { return { ...this.geoms[n], name: n.substr(6) } })
  }
  get lines() { // eslint-disable-line
    const names = Object.keys(this.geoms).filter((n) => n.includes('line'))
    return names.map((n) => {
      const l = this.geoms[n] as Line
      const m = (l.By - l.Ay) / (l.Bx - l.Ax)
      const b = l.By - m * l.Bx
      const x1 = -50
      const x2 = 50
      const y1 = m * x1 + b
      const y2 = m * x2 + b
      return { x1: x1, x2: x2, y1: y1, y2: y2, name: n }
    })
  }
  get circles() { // eslint-disable-line
    const names = Object.keys(this.geoms).filter((n) => n.includes('circle'))
    return names.map((n) => { return { ...this.geoms[n], name: n } })
  }
}
</script>

<style scoped lang="stylus">
svg
  background-color red

.geoms
  display block
  object-fit cover

.geoms-svg
  width 100%
  height 800px

.circle
  stroke white
  stroke-width 8
  vector-effect non-scaling-stroke
  fill none

.point
  fill black

.line
  stroke white
  stroke-width 8
  vector-effect non-scaling-stroke

.label
  font-size 3px
  alignment-baseline middle
  transform translate(1px, 1px)
</style>
