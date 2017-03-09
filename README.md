# Position Based Dynamics

![Implementation](https://raw.githubusercontent.com/docwhite/pbd/master/jakobsen/image.png)

Implementation of constraint-based verlet solvers explained by Jakobsen's
[Advanced Character Physics](http://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf)
and Muller's [Position Based Dynamics](http://matthias-mueller-fischer.ch/publications/posBasedDyn.pdf).

You can play with the Jakobsen-style [demo](https://docwhite.github.io/pbd), the source
code is under **/jakobsen** folder in this [repository](https://github.com/docwhite/pbd).
These are the things you can do:

* ``UP ARROW`` Increases the gravity (adds positive values).
* ``DOWN ARROW`` Decreases the gravity (subtracts positive values).
* ``Left Mouse Click & Drag`` Create pin constraints that drag the points but
  ** don't break it **
* ``Middle Mouse Click & Drag`` Same as left mouse but the contraints can break.

Some [documentation](https://docwhite.github.io/pbd/out) about how
**ParticleSystem**, **PinConstraint** and **SpringConstraint**.
