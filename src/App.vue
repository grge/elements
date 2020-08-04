<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </div>
    <router-view/>
  </div>
</template>

<style lang="stylus">
#app
  font-family Avenir, Helvetica, Arial, sans-serif
  -webkit-font-smoothing antialiased
  -moz-osx-font-smoothing grayscale
  text-align center
  height 100vh
  display grid
  grid-template-columns 400px auto
  grid-template-rows 40px auto
  row-gap 8px
  column-gap 8px

#nav
 padding-top 5px
 grid-column 1 / 3
 grid-row 1 / 2

html, body
  padding 0
  margin 0

</style>
