# Position Based Dynamics

![Implementation](https://raw.githubusercontent.com/eulersson/position-based-dynamics/master/jakobsen/image.png)

Implementation of constraint-based verlet solvers explained by Jakobsen's
[Advanced Character Physics](http://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf)
and Muller's [Position Based Dynamics](http://matthias-mueller-fischer.ch/publications/posBasedDyn.pdf).

You can play with the Jakobsen-style [demo](https://eulersson.github.io/position-based-dynamics), the source
code is under **/jakobsen** folder in this [repository](https://github.com/eulersson/position-based-dynamics).
These are the things you can do:

* ``UP ARROW`` Increases the gravity (adds positive values).
* ``DOWN ARROW`` Decreases the gravity (subtracts positive values).
* ``Left Mouse Click & Drag`` Create pin constraints that drag the points.
* ``Middle Mouse Click & Drag`` Same as left mouse but the contraints cannot break.
* ``N`` Sets the number of iterations to evaluate the constraints.
* ``B`` Sets the breaking threshold (in pixels) to tell when the spring constraint should break.

Some [documentation](https://eulersson.github.io/position-based-dynamics/out) about how
**ParticleSystem**, **PinConstraint** and **SpringConstraint**.
