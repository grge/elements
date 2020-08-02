<template>
  <div class="home">
    <Geoms :geoms="geoms"/>
  </div>
</template>

<script lang='ts'>
// @ is an alias to /src
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
    Geoms
  }
}
</script>
