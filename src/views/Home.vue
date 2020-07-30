<template>
  <div class="home">
    <Geoms :geoms="geoms"/>
  </div>
</template>

<script lang='ts'>
// @ is an alias to /src
import Geoms from '@/components/Geoms.vue'
import { geoms } from '@/geom/play'

export default {
  name: 'Home',
  data: () => { //eslint-disable-line
    return {
      geoms: geoms
    }
  },
  components: {
    Geoms
  }
}
</script>
